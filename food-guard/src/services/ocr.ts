export type OcrResult =
  | {
      ok: true;
      text: string;
      sourceImageUri: string;
    }
  | {
      ok: false;
      message: string;
      sourceImageUri?: string;
    };

export async function recognizeIngredientText(imageUri: string): Promise<OcrResult> {
  try {
    const module = await import("@infinitered/react-native-mlkit-text-recognition");
    const result = await module.recognizeText(imageUri);
    const text = result.text?.trim() ?? "";

    if (!text) {
      return {
        ok: false,
        sourceImageUri: imageUri,
        message: "OCR did not find readable ingredient text."
      };
    }

    return {
      ok: true,
      text,
      sourceImageUri: imageUri
    };
  } catch (error) {
    return {
      ok: false,
      sourceImageUri: imageUri,
      message:
        error instanceof Error
          ? error.message
          : "OCR failed. Use a development build with the ML Kit text-recognition native module."
    };
  }
}
