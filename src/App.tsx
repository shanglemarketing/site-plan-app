import { useRef, useState } from "react";
import CanvasStage from "./components/CanvasStage";
import "./App.css";

function App() {
  const stageRef = useRef<any>(null); // <-- define the ref
  const [showHelp, setShowHelp] = useState(false);

  const handleExport = () => {
    if (!stageRef.current) return;
    const uri = stageRef.current.toDataURL({ pixelRatio: 2 });
    const link = document.createElement("a");
    link.download = "site_plan.png";
    link.href = uri;
    link.click();
  };

  return (
    <div className="w-screen h-screen bg-neutral-900 flex flex-col items-center justify-start overflow-hidden relative">
      <h1 className="text-[clamp(1.5rem,4vw,3rem)] font-bold text-white mt-4 mb-2">
        Site Plan App
      </h1>
      <div className="w-[90vw] h-[90vh] max-w-[1600px]">
        <CanvasStage ref={stageRef} />
      </div>

      <button
        className="absolute bottom-6 right-6 bg-white text-black px-4 py-2 rounded-full shadow-md hover:bg-gray-200 transition"
        onClick={() => setShowHelp(true)}
      >
        Help
      </button>

      <button onClick={handleExport}>Export Image</button>

      {showHelp && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-[600px] w-[90%] text-black relative">
            <button
              onClick={() => setShowHelp(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-black text-xl"
            >
              &times;
            </button>
            <h2 className="text-xl font-bold mb-4">
              How to Use the Site Plan App
            </h2>
            <ul className="list-disc list-inside space-y-2 text-sm">
              {/* your help content here */}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
