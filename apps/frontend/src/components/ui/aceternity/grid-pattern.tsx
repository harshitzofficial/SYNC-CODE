export const GridPattern = () => {
  return (
    <div className="absolute inset-0 -z-10 h-full w-full select-none overflow-hidden">
      <div
        className="absolute h-full w-full"
        style={{
          backgroundImage: `radial-gradient(#808080 1px, transparent 1px),
            radial-gradient(#808080 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
          backgroundPosition: "0 0, 20px 20px",
          maskImage: "radial-gradient(circle at center, white, transparent 80%)",
          WebkitMaskImage: "radial-gradient(circle at center, white, transparent 80%)",
        }}
      />
    </div>
  );
};