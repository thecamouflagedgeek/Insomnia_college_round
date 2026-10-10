export function LoadingState({ message = 'Verifying cryptographic authorization...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <div className="relative w-12 h-12 mb-4">
        <div className="absolute inset-0 rounded-full border-4 border-purple-100"></div>
        <div className="absolute inset-0 rounded-full border-4 border-[#5B3FA3] border-t-transparent animate-spin"></div>
      </div>
      <p className="text-sm font-medium text-[#777487]">{message}</p>
    </div>
  );
}
