import React, { useRef, useEffect } from "react";
import type { RefObject } from "react";
import { Transformer } from "react-konva";
import Konva from "konva";

interface Props {
  shapeRef: RefObject<Konva.Node>;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (attrs: any) => void;
  children: React.ReactElement<any>;
}

export default function TransformableShape({
  shapeRef,
  isSelected,
  onSelect,
  onChange,
  children,
}: Props) {
  const transformerRef = useRef<Konva.Transformer>(null);

  const handleDragEnd = () => {
    const node = shapeRef.current;
    if (!node) return;

    onChange({
      x: node.x(),
      y: node.y(),
    });
  };

  const handleTransformEnd = () => {
    const node = shapeRef.current;
    if (!node) return;

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    const type = node.name();

    const newAttrs: any = {
      x: node.x(),
      y: node.y(),
      rotation: node.rotation(),
    };

    if (type === "structure") {
      newAttrs.width = (node as any).width() * scaleX;
      newAttrs.length = (node as any).height() * scaleY;
      node.scaleX(1);
      node.scaleY(1);
    } else {
      newAttrs.scaleX = scaleX;
      newAttrs.scaleY = scaleY;
    }

    onChange(newAttrs);
  };

  useEffect(() => {
    if (
      isSelected &&
      shapeRef.current &&
      transformerRef.current &&
      ["structure", "septic"].includes(shapeRef.current.name())
    ) {
      transformerRef.current.nodes([shapeRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected, shapeRef]);

  return (
    <>
      {React.cloneElement(children, {
        ref: shapeRef as any,
        draggable: true,
        onClick: onSelect,
        onTap: onSelect,
        onDragEnd: handleDragEnd,
        onTransformEnd: handleTransformEnd,
      })}

      {isSelected && ["structure", "septic"].includes(children.props.name) && (
        <Transformer
          ref={transformerRef}
          rotateEnabled={true}
          enabledAnchors={[
            "top-left",
            "top-right",
            "bottom-left",
            "bottom-right",
            "top-center",
            "bottom-center",
            "middle-left",
            "middle-right",
          ]}
          keepRatio={false}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 20 || newBox.height < 20) return oldBox;
            return newBox;
          }}
        />
      )}
    </>
  );
}
