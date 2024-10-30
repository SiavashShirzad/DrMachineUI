import React from 'react';

const InfiniteLineDrawer = ({ x1, y1, angle}) => {
  // Convert angle from degrees to radians
  const angleRadians = (angle * Math.PI) / 180;

  // Calculate the line width to ensure it covers the diagonal distance of the screen
  const calculateLineWidth = () => {
    return Math.sqrt(window.innerWidth ** 2 + window.innerHeight ** 2);
  };

  // Determine the best starting point for the line
  const getLineStartPosition = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Calculate the tangent of the angle
    const tan = Math.tan(angleRadians);

    // Depending on the quadrant, calculate the appropriate starting point
    if (tan > 0) {
      if (angle < 90) {
        // Starting from the bottom left corner
        const x = 0;
        const y = y1 - x1 * tan;
        return { x, y };
      } else {
        // Starting from the top right corner
        const x = width;
        const y = y1 + (width - x1) * tan;
        return { x, y };
      }
    } else {
      if (angle > 90) {
        // Starting from the bottom right corner
        const x = width;
        const y = y1 + (width - x1) * tan;
        return { x, y };
      } else {
        // Starting from the top left corner
        const x = 0;
        const y = y1 - x1 * tan;
        return { x, y };
      }
    }
  };

  const { x, y } = getLineStartPosition();

  const lineStyle = {
    position: 'absolute',
    top: `${y}px`,
    left: `${x}px`,
    width: `${calculateLineWidth()}px`,
    height: '2px',
    backgroundColor: 'red',
    transform: `rotate(${angle}deg)`,
    transformOrigin: '0 0' // Rotate around the starting point
  };

  const containerStyle = {
    position: 'absolute',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    border: '1px solid black'
  };

  return (
    <div style={containerStyle}>
      <div style={lineStyle} />
    </div>
  );
};

export default InfiniteLineDrawer;
