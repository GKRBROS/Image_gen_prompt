"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import ImageUpload from "./ImageUpload";
import ImagePreview from "./ImagePreview";
import { PROMPTS } from "@/lib/prompts";

type GenderOption = "neutral" | "male" | "female";

export default function ImageGenerator() {
  const [name, setName] = useState("");
  const [gender, setGender] = useState<GenderOption>("neutral");
  const [useCustomPrompt, setUseCustomPrompt] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedImagePreview, setUploadedImagePreview] = useState<
    string | null
  >(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [finalImage, setFinalImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCustomPrompt(PROMPTS[gender]);
  }, [gender]);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setError(null);
    const reader = new FileReader();
    reader.onloadend = () => {
      setUploadedImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!name.trim()) {
      setError("Please enter a name");
      return;
    }
    if (!selectedFile) {
      setError("Please upload an image first");
      return;
    }
    if (!customPrompt.trim()) {
      setError("Prompt is empty");
      return;
    }

    setError(null);
    setLoading(true);
    setGeneratedImage(null);
    setFinalImage(null);

    try {
      const formData = new FormData();
      formData.append("image", selectedFile);
      formData.append("name", name);
      formData.append("gender", gender);
      formData.append("useCustomPrompt", String(useCustomPrompt));
      formData.append("customPrompt", customPrompt);

      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = `Server error (${response.status})`;
        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } else {
            const text = await response.text();
            errorMessage = text.slice(0, 150) || errorMessage;
          }
        } catch {
          errorMessage = `Server error (${response.status})`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setGeneratedImage(data.generatedImage);
      setFinalImage(data.finalImage);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setUploadedImagePreview(null);
    setGeneratedImage(null);
    setFinalImage(null);
    setError(null);
    setGender("neutral");
    setCustomPrompt(PROMPTS.neutral);
    setUseCustomPrompt(false);
  };

  const isFormValid = name.trim() !== "" && selectedFile !== null;

  return (
    <div className="bg-gray-800/40 backdrop-blur-md rounded-3xl p-4 sm:p-6 md:p-8 pt-0 shadow-3xl border border-white/10 transition-all duration-300">
      {!finalImage ? (
        <div className="space-y-6 sm:space-y-8">
          <div className="grid grid-cols-1 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-blue-300 uppercase tracking-wider">
                Full Name
              </label>
              <input
                type="text"
                placeholder="e.g. MOHANLAL"
                disabled={loading}
                className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-base sm:text-sm ${
                  loading ? "opacity-50 cursor-not-allowed" : ""
                }`}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-blue-300 uppercase tracking-wider">
              Portrait Style <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4">
              {(["neutral", "male", "female"] as GenderOption[]).map(
                (option) => (
                  <button
                    key={option}
                    onClick={() => setGender(option)}
                    disabled={loading}
                    className={`py-2 sm:py-3 px-3 sm:px-4 rounded-lg font-medium text-xs sm:text-sm transition-all duration-200 capitalize ${
                      loading ? "opacity-50 cursor-not-allowed" : ""
                    } ${
                      gender === option
                        ? "bg-blue-600 text-white shadow-lg ring-2 ring-blue-400/50"
                        : "bg-white/5 text-gray-300 border border-white/10 hover:border-white/20"
                    }`}
                  >
                    {option}
                  </button>
                ),
              )}
            </div>
            <p className="text-xs text-gray-400">
              Choose the gender presentation style for the portrait
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 mb-2">
            <label
              className={`flex items-center gap-2 transition-opacity ${
                loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
              } group`}
            >
              <input
                type="checkbox"
                checked={useCustomPrompt}
                onChange={(e) => setUseCustomPrompt(e.target.checked)}
                disabled={loading}
                className="w-5 h-5 accent-blue-500 cursor-pointer rounded disabled:cursor-not-allowed"
              />
              <span className="text-xs font-medium text-gray-400 group-hover:text-gray-300 uppercase tracking-wider transition-colors">
                Override
              </span>
            </label>
          </div>

          {useCustomPrompt && (
            <div className="space-y-2 animate-in fade-in-50 duration-200 p-3 sm:p-4 bg-white/5 border border-blue-500/30 rounded-lg mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-blue-300 uppercase tracking-wider">
                  Edit Prompt
                </span>
                <span className="text-xs px-2 py-1 bg-orange-500/20 text-orange-300 rounded">
                  Optional
                </span>
              </div>
              <textarea
                placeholder="Edit the prompt to customize the portrait generation..."
                disabled={loading}
                className={`w-full min-h-[140px] sm:min-h-[160px] bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all resize-none text-sm sm:text-base font-mono leading-relaxed ${
                  loading ? "opacity-50 cursor-not-allowed" : ""
                }`}
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
              />
              <div className="flex justify-between items-center text-xs pt-2">
                <p
                  className={
                    customPrompt ? "text-green-400/60" : "text-gray-500"
                  }
                >
                  {customPrompt ? "✓ Ready" : "Empty"}
                </p>
                <p className="text-gray-500">
                  {customPrompt.length} characters
                </p>
              </div>
              <button
                onClick={() => setCustomPrompt(PROMPTS[gender])}
                disabled={loading}
                className={`text-xs w-full mt-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg text-gray-300 hover:text-white transition-all ${
                  loading ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                ↻ Reset to {gender} template
              </button>
            </div>
          )}

          <div className="pt-4 border-t border-white/5">
            {uploadedImagePreview ? (
              <div
                className={`space-y-4 sm:space-y-6 text-center ${loading ? "opacity-50 pointer-events-none" : ""}`}
              >
                <div className="relative inline-block group">
                  <Image
                    src={uploadedImagePreview}
                    alt="Preview"
                    width={192}
                    height={192}
                    className="w-40 h-40 sm:w-48 sm:h-48 object-cover rounded-2xl border-2 border-blue-500/30"
                    unoptimized
                  />
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      setUploadedImagePreview(null);
                    }}
                    disabled={loading}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg disabled:cursor-not-allowed"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
                <p className="text-blue-400 font-medium text-sm sm:text-base">
                  Image Selected! ✨
                </p>
              </div>
            ) : (
              <ImageUpload onImageUpload={handleFileSelect} />
            )}
          </div>

          <div className="space-y-3 sm:space-y-4">
            {error && (
              <div className="p-3 sm:p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs sm:text-sm text-center">
                {error}
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={!isFormValid || loading}
              className={`w-full py-3 sm:py-4 rounded-xl font-bold text-sm sm:text-lg tracking-wider transition-all duration-300 flex items-center justify-center gap-3
                ${
                  isFormValid && !loading
                    ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 shadow-[0_0_20px_rgba(37,99,235,0.4)] text-white"
                    : "bg-white/5 text-gray-500 border border-white/10 cursor-not-allowed"
                }`}
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5 sm:h-6 sm:w-6 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span>GENERATING...</span>
                </>
              ) : (
                "GENERATE POSTER"
              )}
            </button>
          </div>
        </div>
      ) : (
        <ImagePreview
          uploadedImage={uploadedImagePreview || ""}
          generatedImage={generatedImage}
          finalImage={finalImage}
          loading={loading}
          error={error}
          onReset={handleReset}
        />
      )}
    </div>
  );
}
