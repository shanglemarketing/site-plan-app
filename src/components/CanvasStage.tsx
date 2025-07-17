import React, { useRef, useState, useEffect } from "react";
import { forwardRef, useImperativeHandle } from "react";
import {
  Stage,
  Layer,
  Image as KonvaImage,
  Circle,
  Group,
  Line,
  Rect,
  Path,
  Text,
} from "react-konva";
import type Konva from "konva";
import TransformableShape from "./TransformableShape";
import { Html } from "react-konva-utils";

interface ShapeObject {
  id: string;
  type: "well" | "septic" | "structure" | "ruler";
  x: number;
  y: number;
  x2?: number; // for ruler endpoint
  y2?: number;
  width?: number;
  length?: number;
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
}

const CanvasStage = (_: any, ref: React.Ref<any>) => {
  const stageRef = useRef<Konva.Stage>(null);
  useImperativeHandle(ref, () => ({
    toDataURL: (options?: any) => {
      return stageRef.current?.toDataURL(options);
    },
  }));
  const [shapeRefs, setShapeRefs] = useState<
    Record<string, React.RefObject<Konva.Node>>
  >({});
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [scaleFactor, setScaleFactor] = useState<number | null>(null);
  const [scalePoints, setScalePoints] = useState<{ x: number; y: number }[]>(
    []
  );
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(
    null
  );
  const [isSettingScale, setIsSettingScale] = useState(false);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [objects, setObjects] = useState<ShapeObject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    targetId: string | null;
  } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<"width" | "length" | null>(
    null
  );
  const [inputValue, setInputValue] = useState("");

  const placeNewShape = (tool: string, pointer: { x: number; y: number }) => {
    const id = crypto.randomUUID();
    const pxPerFt = scaleFactor || 1;

    if (tool === "structure") {
      const len = parseFloat(prompt("Structure length (ft):") || "0") * pxPerFt;
      const wid = parseFloat(prompt("Structure width (ft):") || "0") * pxPerFt;
      if (len > 0 && wid > 0) {
        setObjects((prev) => [
          ...prev,
          {
            id,
            type: "structure",
            x: pointer.x,
            y: pointer.y,
            length: len,
            width: wid,
          },
        ]);
      }
    } else if (tool === "well" || tool === "septic") {
      const defaultSize = 80;
      setObjects((prev) => [
        ...prev,
        {
          id,
          type: tool,
          x: pointer.x,
          y: pointer.y,
          width: defaultSize,
          length: defaultSize,
        },
      ]);
    } else if (tool === "ruler") {
      setObjects((prev) => [
        ...prev,
        {
          id,
          type: "ruler",
          x: pointer.x,
          y: pointer.y,
          x2: pointer.x + 100,
          y2: pointer.y,
        },
      ]);
    }
  };

  const handleShapeSelection = (target: Konva.Node) => {
    let node: Konva.Node | null = target;

    // Traverse up the node tree to find a known shape
    while (node && !objects.find((obj) => obj.id === node?.id())) {
      node = node.getParent();
    }

    if (node?.id?.()) {
      setSelectedId(node.id());
    } else {
      setSelectedId(null);
    }
  };

  // Utility to rotate a point around a center
  const getRotatedPoint = ({
    x,
    y,
    rotation,
    cx,
    cy,
  }: {
    x: number;
    y: number;
    rotation: number;
    cx: number;
    cy: number;
  }) => {
    const rad = (Math.PI / 180) * rotation;
    const dx = x - cx;
    const dy = y - cy;

    return {
      x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
      y: cy + dx * Math.sin(rad) + dy * Math.cos(rad),
    };
  };

  useEffect(() => {
    const newRefs: Record<string, React.RefObject<Konva.Node>> = {};
    objects.forEach((obj) => {
      newRefs[obj.id] = shapeRefs[obj.id] || React.createRef<Konva.Node>();
    });
    setShapeRefs(newRefs);
  }, [objects]);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      const image = new window.Image();
      image.src = reader.result as string;

      image.onload = () => {
        const { width, height } = image;

        // Set the image
        setImage(image);

        // Resize the stage to match the image dimensions
        if (stageRef.current) {
          stageRef.current.width(width);
          stageRef.current.height(height);
          stageRef.current.position({ x: 0, y: 0 });
          stageRef.current.batchDraw();
        }
      };
    };

    reader.readAsDataURL(file);
  };

  const handleMouseMove = () => {
    if (!isSettingScale || scalePoints.length !== 1 || !stageRef.current)
      return;
    const pos = stageRef.current.getPointerPosition();
    if (pos) setHoverPos(pos);
  };

  const handleClick = () => {
    if (!isSettingScale || !stageRef.current) return;
    const pointer = stageRef.current.getPointerPosition();
    if (!pointer) return;

    if (selectedTool === "ruler") {
      const id = crypto.randomUUID();
      const startX = pointer.x;
      const startY = pointer.y;
      const offset = 100;

      setObjects((prev) => [
        ...prev,
        {
          id,
          type: "ruler",
          x: startX,
          y: startY,
          x2: startX + offset,
          y2: startY,
        },
      ]);

      setSelectedTool(null);
      return;
    }

    const newPoints = [...scalePoints, pointer];
    if (newPoints.length === 2) {
      const [p1, p2] = newPoints;
      const pixelDistance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const input = prompt("Enter real-world distance (feet):");
      const realDistance = parseFloat(input || "0");
      if (realDistance <= 0) {
        alert("Invalid distance");
        return;
      }

      setScaleFactor(pixelDistance / realDistance);
      alert(`Scale set: ${(pixelDistance / realDistance).toFixed(2)} px/ft`);
      setScalePoints([]);
      setHoverPos(null);
      setIsSettingScale(false);
    } else {
      setScalePoints(newPoints);
    }
  };

  const handleUpdate = (id: string, newAttrs: Partial<ShapeObject>) => {
    const updated = objects.map((obj) => {
      if (obj.id !== id) return obj;
      const merged: ShapeObject = { ...obj };

      for (const key in newAttrs) {
        const value = newAttrs[key as keyof ShapeObject];
        if (value !== undefined) {
          (merged as any)[key] = value;
        }
      }

      return merged;
    });

    setObjects(updated);
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "10px",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 10,
            marginBottom: 10,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <input type="file" accept="image/*" onChange={handleUpload} />
          <button
            onClick={() => {
              setIsSettingScale(true);
              setScalePoints([]);
            }}
          >
            Set Scale
          </button>
          <button onClick={() => setSelectedTool("well")}>Well</button>
          <button onClick={() => setSelectedTool("septic")}>Septic</button>
          <button onClick={() => setSelectedTool("structure")}>
            Structure
          </button>
          <button onClick={() => setSelectedTool("ruler")}>Ruler</button>
        </div>
      </div>

      {scaleFactor && (
        <p style={{ color: "white", marginBottom: 10 }}>
          Scale: {scaleFactor.toFixed(2)} px/ft
        </p>
      )}

      {contextMenu && (
        <div
          style={{
            position: "absolute",
            left: contextMenu.x,
            top: contextMenu.y,
            background: "white",
            border: "1px solid #aaa",
            padding: "2px 6px",
            borderRadius: "4px",
            zIndex: 10,
            fontSize: "13px",
            color: "black", // ✅ This ensures the "Delete" text is black
            display: "flex",
            justifyContent: "center",
            overflow: "auto",
            alignItems: "center",
            gap: "4px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
          }}
          onClick={() => {
            setObjects((prev) =>
              prev.filter((obj) => obj.id !== contextMenu.targetId)
            );
            setContextMenu(null);
          }}
        >
          <span style={{ color: "red", fontWeight: "bold" }}>✕</span> Delete
        </div>
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          width: "100%",
          overflow: "hidden",
          background: "#222", // Optional for contrast
        }}
      >
        <Stage
          ref={stageRef}
          width={image?.width || 800}
          height={image?.height || 600}
          style={{ display: "block" }}
          onMouseDown={(e) => {
            const stage = e.target.getStage();
            const pointer = stage?.getPointerPosition();
            const target = e.target;

            // 1. Handle scale setting
            if (isSettingScale) {
              handleClick();
              return;
            }

            // 2. Handle placing a new shape
            const isTrulyEmpty =
              target === stage || target.className === "Image";
            if (selectedTool && isTrulyEmpty && pointer) {
              placeNewShape(selectedTool, pointer);
              setSelectedTool(null);
              return;
            }

            // 3. Ignore clicks on Transformer or its children
            const clickedTransformer = !!target.findAncestor(
              (node: Konva.Node) => node.getClassName() === "Transformer"
            );

            if (clickedTransformer) return;

            // 4. Handle selecting shapes
            handleShapeSelection(target);

            // Close context menu if open
            if (contextMenu) setContextMenu(null);
          }}
          onMouseMove={handleMouseMove}
          onContextMenu={(e) => {
            e.evt.preventDefault();

            const stage = stageRef.current;
            const pointer = stage?.getPointerPosition();
            const targetId = e.target?.id?.();

            if (!stage || !pointer || !targetId) return;

            const rect = stage.container().getBoundingClientRect();

            setContextMenu({
              x: rect.left + pointer.x,
              y: rect.top + pointer.y,
              targetId,
            });
          }}
        >
          <Layer>
            {image && (
              <KonvaImage
                image={image}
                width={image.width}
                height={image.height}
              />
            )}

            {isSettingScale && scalePoints.length === 1 && hoverPos && (
              <Line
                points={[
                  scalePoints[0].x,
                  scalePoints[0].y,
                  hoverPos.x,
                  hoverPos.y,
                ]}
                stroke="red"
                strokeWidth={2}
                dash={[4, 4]}
              />
            )}

            {scalePoints.map((pt, i) => (
              <Circle key={i} x={pt.x} y={pt.y} radius={5} fill="red" />
            ))}

            {objects.map((obj) => {
              const widthFt =
                obj.width !== undefined && scaleFactor
                  ? (obj.width / scaleFactor).toFixed(1)
                  : null;

              const lengthFt =
                obj.length !== undefined && scaleFactor
                  ? (obj.length / scaleFactor).toFixed(1)
                  : null;

              if (
                obj.type === "ruler" &&
                typeof obj.x2 === "number" &&
                typeof obj.y2 === "number"
              ) {
                const dx = obj.x2 - obj.x;
                const dy = obj.y2 - obj.y;

                const angleRad = Math.atan2(dy, dx);
                let angleDeg = (angleRad * 180) / Math.PI;
                if (angleDeg > 90 || angleDeg < -90) angleDeg += 180;

                return (
                  <React.Fragment key={obj.id}>
                    {(() => {
                      const dx = obj.x2! - obj.x;
                      const dy = obj.y2! - obj.y;
                      const midX = (obj.x + obj.x2!) / 2;
                      const midY = (obj.y + obj.y2!) / 2;
                      const length = Math.sqrt(dx * dx + dy * dy);
                      const feet = scaleFactor
                        ? (length / scaleFactor).toFixed(1)
                        : "0.0";

                      const angleRad = Math.atan2(dy, dx);
                      let angleDeg = (angleRad * 180) / Math.PI;
                      if (angleDeg > 90 || angleDeg < -90) angleDeg += 180;

                      const padding = 14;
                      const offsetX = padding * Math.sin(angleRad);
                      const offsetY = -padding * Math.cos(angleRad);
                      const labelX = midX + offsetX;
                      const labelY = midY + offsetY;

                      return (
                        <>
                          {/* DRAGGABLE GROUP with wide transparent hitbox */}
                          <Group
                            draggable
                            onDragMove={(e) => {
                              const pointer = e.target
                                .getStage()
                                ?.getPointerPosition();
                              if (!pointer) return;
                              const deltaX = pointer.x - midX;
                              const deltaY = pointer.y - midY;
                              handleUpdate(obj.id, {
                                x: obj.x + deltaX,
                                y: obj.y + deltaY,
                                x2: obj.x2! + deltaX,
                                y2: obj.y2! + deltaY,
                              });
                              e.target.position({ x: 0, y: 0 });
                            }}
                          >
                            {/* Transparent wide hitbox line */}
                            <Line
                              points={[obj.x, obj.y, obj.x2!, obj.y2!]}
                              stroke="transparent"
                              strokeWidth={20}
                            />
                            {/* Actual visible thin line */}
                            <Line
                              id={obj.id}
                              points={[obj.x, obj.y, obj.x2!, obj.y2!]}
                              stroke="black"
                              strokeWidth={2}
                              listening={false}
                            />
                          </Group>

                          {/* Label outside group so it's clickable */}
                          {editingId === obj.id && editingField === "length" ? (
                            <Html
                              groupProps={{
                                x: labelX,
                                y: labelY,
                              }}
                            >
                              <input
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onBlur={() => {
                                  const newLength =
                                    parseFloat(inputValue) * scaleFactor!;
                                  const ratio = newLength / length;
                                  const newX2 = obj.x + dx * ratio;
                                  const newY2 = obj.y + dy * ratio;
                                  handleUpdate(obj.id, {
                                    x2: newX2,
                                    y2: newY2,
                                  });
                                  setEditingId(null);
                                  setEditingField(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") e.currentTarget.blur();
                                }}
                                style={{
                                  width: "50px",
                                  fontSize: "14px",
                                  textAlign: "center",
                                  transform: "none", // ✨ fixed horizontal
                                }}
                                autoFocus
                              />
                            </Html>
                          ) : (
                            <Text
                              text={`${feet}'`}
                              x={labelX}
                              y={labelY}
                              rotation={angleDeg}
                              offsetX={`${feet}'`.length * 3}
                              offsetY={7}
                              fontSize={14}
                              fill="black"
                              align="center"
                              verticalAlign="middle"
                              onClick={() => {
                                setEditingId(obj.id);
                                setEditingField("length");
                                setInputValue(feet || "");
                              }}
                            />
                          )}

                          {/* Endpoints */}
                          <Circle
                            id={obj.id + "_start"}
                            x={obj.x}
                            y={obj.y}
                            radius={6}
                            fill="blue"
                            draggable
                            onDragMove={(e) => {
                              handleUpdate(obj.id, {
                                x: e.target.x(),
                                y: e.target.y(),
                              });
                            }}
                          />
                          <Circle
                            id={obj.id + "_end"}
                            x={obj.x2}
                            y={obj.y2}
                            radius={6}
                            fill="blue"
                            draggable
                            onDragMove={(e) => {
                              handleUpdate(obj.id, {
                                x2: e.target.x(),
                                y2: e.target.y(),
                              });
                            }}
                          />
                        </>
                      );
                    })()}
                  </React.Fragment>
                );
              }

              // Fallback for other shapes
              return (
                <React.Fragment key={obj.id}>
                  <TransformableShape
                    shapeRef={shapeRefs[obj.id]}
                    isSelected={selectedId === obj.id}
                    onSelect={() => setSelectedId(obj.id)}
                    onChange={(attrs) => handleUpdate(obj.id, attrs)}
                  >
                    {obj.type === "well" ? (
                      <Circle
                        name="well"
                        id={obj.id}
                        x={obj.x}
                        y={obj.y}
                        radius={8}
                        fill="blue"
                      />
                    ) : obj.type === "septic" ? (
                      <Path
                        name="septic"
                        id={obj.id}
                        x={obj.x}
                        y={obj.y}
                        data="M82.844,107.964h0s-.039.295-.039.295c-2.518,18.994-29.278,20.857-34.404,2.395h0s-.076.07-.076.07c-14.047,12.967-35.751-2.724-27.842-20.128h0s0,0,0,0c-19.1.985-25.77-24.958-8.564-33.308l.235-.114h0c-15.293-11.62-3.665-35.853,14.968-31.195l.189.047-.042-.19C23.123,7.083,47.666-3.876,58.863,11.729h0s.121-.232.121-.232c8.818-16.971,34.568-9.593,33.061,9.473h0s0,0,0,0c17.614-7.43,32.705,14.696,19.358,28.383l-.072.074h0c18.314,5.63,15.719,32.329-3.337,34.326l-.296.031h0c10.366,16.211-8.932,34.987-24.853,24.181Z"
                        fill="green"
                        stroke="black"
                        strokeWidth={2}
                        scaleX={obj.scaleX ?? 0.5}
                        scaleY={obj.scaleY ?? 0.5}
                      />
                    ) : (
                      <Rect
                        name="structure"
                        id={obj.id}
                        x={obj.x}
                        y={obj.y}
                        width={obj.width}
                        height={obj.length}
                        fill="brown"
                      />
                    )}
                  </TransformableShape>

                  {/* Structure labels */}
                  {obj.type === "structure" && scaleFactor && (
                    <>
                      {editingId === obj.id && editingField === "width" ? (
                        <Html
                          groupProps={{
                            ...getRotatedPoint({
                              x: obj.x + obj.width! / 2,
                              y: obj.y - 20,
                              rotation: obj.rotation || 0,
                              cx: obj.x,
                              cy: obj.y,
                            }),
                          }}
                        >
                          <input
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onBlur={() => {
                              const newWidth =
                                parseFloat(inputValue) * scaleFactor;
                              handleUpdate(obj.id, { width: newWidth });
                              setEditingId(null);
                              setEditingField(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                            }}
                            style={{
                              width: "50px",
                              fontSize: "14px",
                              textAlign: "center",
                            }}
                            autoFocus
                          />
                        </Html>
                      ) : (
                        <Text
                          text={`${widthFt}' W`}
                          {...getRotatedPoint({
                            x: obj.x,
                            y: obj.y - 20,
                            rotation: obj.rotation || 0,
                            cx: obj.x,
                            cy: obj.y,
                          })}
                          rotation={obj.rotation || 0}
                          fontSize={14}
                          fill="black"
                          onClick={() => {
                            setEditingId(obj.id);
                            setEditingField("width");
                            setInputValue(widthFt || "");
                          }}
                        />
                      )}

                      {editingId === obj.id && editingField === "length" ? (
                        <Html
                          groupProps={{
                            ...getRotatedPoint({
                              x: obj.x + obj.width! + 6,
                              y: obj.y + obj.length! / 2 - 7,
                              rotation: obj.rotation || 0,
                              cx: obj.x,
                              cy: obj.y,
                            }),
                          }}
                        >
                          <input
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onBlur={() => {
                              const newLength =
                                parseFloat(inputValue) * scaleFactor;
                              handleUpdate(obj.id, { length: newLength });
                              setEditingId(null);
                              setEditingField(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                            }}
                            style={{
                              width: "50px",
                              fontSize: "14px",
                              textAlign: "center",
                            }}
                            autoFocus
                          />
                        </Html>
                      ) : (
                        <Text
                          text={`${lengthFt}' L`}
                          {...getRotatedPoint({
                            x: obj.x + obj.width! + 20,
                            y: obj.y,
                            rotation: obj.rotation || 0,
                            cx: obj.x,
                            cy: obj.y,
                          })}
                          rotation={(obj.rotation || 0) + 90}
                          fontSize={14}
                          fill="black"
                          onClick={() => {
                            setEditingId(obj.id);
                            setEditingField("length");
                            setInputValue(lengthFt || "");
                          }}
                        />
                      )}
                    </>
                  )}
                </React.Fragment>
              );
            })}
          </Layer>
        </Stage>
      </div>
    </div>
  );
};

export default forwardRef(CanvasStage);
