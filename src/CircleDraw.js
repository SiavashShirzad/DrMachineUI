import React from 'react';

const CircleDraw = ({ x, y, radius }) => {
  // Styles for the container div
  const containerStyle = {
    position: 'absolute', // This makes it a reference for the absolute positioning of the circle
    top: `0px`,
    left: `0px`,
    border: '1px solid black' // Just to visualize the container
  };

  // Styles for the circle div
  const circleStyle = {
    position: 'absolute',
    top: `${y}px`,
    left: `${x}px`,
    width: `${radius * 1}px`,
    height: `${radius * 1}px`,
    borderRadius: '50%',
    backgroundColor: 'blue', // Change the color as needed
  };

  return (
    <div style={containerStyle}>
      <div style={circleStyle} />
    </div>
  );
};

export default CircleDraw;