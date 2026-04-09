const FadedGrid = () => {
  return (
    <div
      className="absolute inset-0 w-full h-full bg-grid bg-repeat opacity-20"
      style={{
        backgroundSize: '24px 24px',
        maskImage: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.5) 70%, black 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.5) 70%, black 100%)',
      }}
    ></div>
  );
};

export default FadedGrid;