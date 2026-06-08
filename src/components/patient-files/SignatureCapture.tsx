import { useRef, useImperativeHandle, forwardRef } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui-bits";
import { Eraser } from "lucide-react";

export interface SignatureCaptureRef {
  isEmpty: () => boolean;
  clear: () => void;
  getBase64: () => string | null;
}

export const SignatureCapture = forwardRef<SignatureCaptureRef, {}>((props, ref) => {
  const sigCanvas = useRef<SignatureCanvas>(null);

  useImperativeHandle(ref, () => ({
    isEmpty: () => {
      return sigCanvas.current ? sigCanvas.current.isEmpty() : true;
    },
    clear: () => {
      if (sigCanvas.current) {
        sigCanvas.current.clear();
      }
    },
    getBase64: () => {
      if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
        return sigCanvas.current.getCanvas().toDataURL("image/png");
      }
      return null;
    }
  }));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Assinatura Digital</span>
        <Button 
          type="button" 
          variant="ghost" 
          size="sm" 
          onClick={() => sigCanvas.current?.clear()}
          className="text-muted-foreground hover:text-rose-600 h-8"
        >
          <Eraser className="h-3.5 w-3.5 mr-1.5" /> Limpar
        </Button>
      </div>
      <div className="border-2 border-dashed border-border rounded-lg overflow-hidden bg-white">
        <SignatureCanvas
          ref={sigCanvas}
          canvasProps={{
            className: "w-full h-32 sm:h-40 cursor-crosshair",
            style: { width: "100%", height: "100%" }
          }}
          backgroundColor="rgba(255,255,255,1)"
          penColor="#000000"
        />
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Assine no quadro acima usando o mouse ou dedo.
      </p>
    </div>
  );
});

SignatureCapture.displayName = "SignatureCapture";
