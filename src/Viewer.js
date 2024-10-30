import React, { useState, useRef, useEffect } from 'react';
import cornerstone from 'cornerstone-core';
import cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader';
import dicomParser from 'dicom-parser';
import CircleDrawer from './CircleDraw';
import InfiniteLineDrawer from './LineDraw';
import InfiniteLineDrawer2 from './LineDraw2';
import './DicomViewer.css'; // Import a new CSS file for styles
import { Stage, Layer, Line, Circle } from 'react-konva';


function calculateAngleBetween(angleSet1, angleSet2) {
  const angles1Radians = {
    primary: angleSet1.primary * (Math.PI / 180),
    secondary: angleSet1.secondary * (Math.PI / 180),
  };
  const angles2Radians = {
    primary: angleSet2.primary * (Math.PI / 180),
    secondary: angleSet2.secondary * (Math.PI / 180),
  };
  const vector1 = [Math.cos(angles1Radians.primary), Math.sin(angles1Radians.primary)];
  const vector2 = [Math.cos(angles2Radians.primary), Math.sin(angles2Radians.primary)];
  const dotProduct = vector1[0] * vector2[0] + vector1[1] * vector2[1];
  const magnitude1 = Math.sqrt(vector1[0] ** 2 + vector1[1] ** 2);
  const magnitude2 = Math.sqrt(vector2[0] ** 2 + vector2[1] ** 2);
  const cosAngle = dotProduct / (magnitude1 * magnitude2);
  const angleRadians = Math.acos(cosAngle);
  const angleDegrees = angleRadians * (180 / Math.PI);

  return angleDegrees;
}

cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
cornerstoneWADOImageLoader.external.dicomParser = dicomParser;
cornerstoneWADOImageLoader.webWorkerManager.initialize();

const DicomViewer = () => {

  const [contour, setContour] = useState([]);
  const [selectedPointIndex, setSelectedPointIndex] = useState(null);

  const [contour2, setContour2] = useState([]);
  const [selectedPointIndex2, setSelectedPointIndex2] = useState(null);

  const [imageId, setImageId] = useState('');
  const [imageId2, setImageId2] = useState('');

  const [angles, setAngles] = useState(null);
  const [angles2, setAngles2] = useState(null);
  const [finalAngle, setfinalAngle] = useState(null);

  const [totalFrames, setTotalFrames] = useState(0);
  const [totalFrames2, setTotalFrames2] = useState(0);

  const [currentFrame, setCurrentFrame] = useState(0);
  const [currentFrame2, setCurrentFrame2] = useState(0);

  const elementRef = useRef(null);
  const elementRef2 = useRef(null);

  const [endingPoint, setEndingingPoint] = useState(null);
  const [startingPoint, setStartingPoint] = useState(null);
  
  const [endingPoint2, setEndingingPoint2] = useState(null);
  const [startingPoint2, setStartingPoint2] = useState(null);

  const [imageSrc, setImageSrc] = useState('');
  const [imageSrc2, setImageSrc2] = useState('');

  const [RImageSRC, setRImageSRC] = useState('');
  const [RImageSRC2, setRImageSRC2] = useState('');

  const [filesList, setFilesList] = useState([]);
  const [filesList2, setFilesList2] = useState([]);

  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedFile2, setSelectedFile2] = useState(null);

  const [fetchedResults, setfetchedResults] = useState(false);


  useEffect(() => {
    if (angles && angles2) {
      setfinalAngle(calculateAngleBetween(angles, angles2))
    }
  }, [angles, angles2]);

  useEffect(() => {
    if (selectedFile) {
      const imageId = cornerstoneWADOImageLoader.wadouri.fileManager.add(selectedFile);
      setImageId(imageId);
    }
  }, [selectedFile]);

  useEffect(() => {
    if (selectedFile2) {
      const imageId = cornerstoneWADOImageLoader.wadouri.fileManager.add(selectedFile2);
      setImageId2(imageId);
    }
  }, [selectedFile2]);

  useEffect(() => {
    cornerstone.enable(elementRef.current);

    // Add scroll event listener for frame navigation
    const handleScroll = (e) => {
      e.preventDefault();
      const direction = e.deltaY > 0 ? 1 : -1;
      changeFrame(direction);
    };

    const currentElement = elementRef.current;
    currentElement.addEventListener('wheel', handleScroll);

    return () => {
      cornerstone.disable(elementRef.current);
      currentElement.removeEventListener('wheel', handleScroll);
    };
  }, [currentFrame, totalFrames]); 
  
  useEffect(() => {
    cornerstone.enable(elementRef2.current);

    // Add scroll event listener for frame navigation
    const handleScroll2 = (e) => {
      e.preventDefault();
      const direction = e.deltaY > 0 ? 1 : -1;
      changeFrame2(direction);
    };

    const currentElement2 = elementRef2.current;
    currentElement2.addEventListener('wheel', handleScroll2);

    return () => {
      cornerstone.disable(elementRef2.current);
      currentElement2.removeEventListener('wheel', handleScroll2);
    };
  }, [currentFrame2, totalFrames2]); 



  useEffect(() => {
    if (imageId && totalFrames > 0) {
      displayFrame(currentFrame);
    }
  }, [currentFrame, imageId, totalFrames]);

  useEffect(() => {
    if (imageId2 && totalFrames2 > 0) {
      displayFrame2(currentFrame2);
    }
  }, [currentFrame2, imageId2, totalFrames2]);

  useEffect(() => {
    if (imageId) {
      loadAndDisplayImage(imageId);
    }
  }, [imageId]);

  useEffect(() => {
    if (imageId2) {
      loadAndDisplayImage2(imageId2);
    }
  }, [imageId2]);


  const fileEntryToFile = (entry) => {
    return new Promise((resolve) => {
      entry.file(resolve);
    });
  };

 const handleDrop = async (e) => {
  e.preventDefault();
  const items = e.dataTransfer.items;
  if (items) {
    const fileList = [];
    const filePromises = [];
    for (let item of items) {
      const entry = item.webkitGetAsEntry();
      if (entry) {
        if (entry.isDirectory) {
          // Handle directory
          await readDirectory(entry, fileList);
        } else {
          // Handle individual files
          filePromises.push(fileEntryToFile(entry));
        }
      }
    }
    // Wait for all individual file promises to resolve
    const individualFiles = await Promise.all(filePromises);
    fileList.push(...individualFiles);
    updateFilesList(fileList);
  }
};

const readDirectory = async (directoryEntry, fileList) => {
  const dirReader = directoryEntry.createReader();
  let readEntries;
  do {
    readEntries = await new Promise((resolve, reject) => {
      dirReader.readEntries(resolve, reject);
    });
    for (const entry of readEntries) {
      if (entry.isDirectory) {
        await readDirectory(entry, fileList); // Recursively process directories
      } else {
        // Process individual files within directories
        const file = await fileEntryToFile(entry);
        fileList.push(file);
      }
    }
  } while (readEntries.length > 0);
};
  
const handleDrop2 = async (e) => {
  e.preventDefault();
  const items = e.dataTransfer.items;
  if (items) {
    const fileList = [];
    const filePromises = []; // Collect promises for file processing
    for (let item of items) {
      const entry = item.webkitGetAsEntry();
      if (entry) {
        if (entry.isDirectory) {
          // Directories are processed and files within are added to fileList
          await readDirectory2(entry, fileList);
        } else {
          // Individual files are processed asynchronously and their promises collected
          filePromises.push(fileEntryToFile(entry));
        }
      }
    }
    // Await all file processing promises and then add them to fileList
    const individualFiles = await Promise.all(filePromises);
    fileList.push(...individualFiles); // Spread operator to add all elements
    updateFilesList2(fileList); // Update the file list once all processing is complete
  }
};

const readDirectory2 = async (directoryEntry, fileList) => {
  const dirReader = directoryEntry.createReader();
  let entries;
  do {
    entries = await new Promise((resolve, reject) => {
      dirReader.readEntries(resolve, reject);
    });
    // Process each entry in the current batch
    for (const entry of entries) {
      if (entry.isDirectory) {
        // Recursively process directories
        await readDirectory2(entry, fileList);
      } else {
        // Asynchronously convert file entries to files and add them to fileList
        const file = await fileEntryToFile(entry);
        fileList.push(file);
      }
    }
  } while (entries.length > 0); // Continue reading entries if not done
};


  
  const updateFilesList = (fileList) => {
    setFilesList(fileList);
    setSelectedFile(fileList[0])
  };

    const updateFilesList2 = (fileList) => {
    setFilesList2(fileList);
    setSelectedFile2(fileList[0])
  };

  const loadAndDisplayImage = (imageId) => {
    cornerstone.loadImage(imageId).then((image) => {
      setCurrentFrame(0); 
      setTotalFrames(image.data.intString('x00280008') || 1); // Default to 1 if tag is absent
      setAngles({primary:image.data.string('x00181510'), secondary:image.data.string('x00181511')})
    });
  };

  const loadAndDisplayImage2 = (imageId) => {
    cornerstone.loadImage(imageId).then((image) => {
      setCurrentFrame2(0);
      setTotalFrames2(image.data.intString('x00280008') || 1); // Default to 1 if tag is absent
      setAngles2({primary:image.data.string('x00181510'), secondary:image.data.string('x00181511')})
    });
  };

  const displayFrame = (frameIndex) => {
    const frameImageId = `${imageId}?frame=${frameIndex}`;
    cornerstone.loadImage(frameImageId).then((image) => {
      cornerstone.displayImage(elementRef.current, image);
    });
  };

  const displayFrame2 = (frameIndex) => {
    const frameImageId = `${imageId2}?frame=${frameIndex}`;
    cornerstone.loadImage(frameImageId).then((image) => {
      cornerstone.displayImage(elementRef2.current, image);
    });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const changeFrame = (increment) => { 
    const newIndex = currentFrame + increment;
    if (newIndex >= 0 && newIndex < totalFrames) {
      setCurrentFrame(newIndex);
    }
    setEndingingPoint(null)
    setStartingPoint(null)
  };

  const changeFrame2 = (increment) => {
    const newIndex = currentFrame2 + increment;
    if (newIndex >= 0 && newIndex < totalFrames2) {
      setCurrentFrame2(newIndex);
    }
    setEndingingPoint2(null)
    setStartingPoint2(null)
  };


  const mouseClick2 = (e) => {

    if (e.target !== elementRef2.current && !elementRef2.current.contains(e.target)) {
      return;
    }

    if (fetchedResults) {
      return
    }

    const boundingRect2 = elementRef2.current.getBoundingClientRect();
    const xPosition = e.clientX - boundingRect2.left;
    const yPosition = e.clientY - boundingRect2.top;
    console.log(xPosition,yPosition)

    if (imageId2 !== ''){
      if (startingPoint2 == null) {
        setStartingPoint2({ x: parseInt(xPosition), y: parseInt(yPosition) });
      } else if (endingPoint2 == null) {
        setEndingingPoint2({ id: currentFrame2, starting: startingPoint2, ending: { x: parseInt(xPosition) , y: parseInt(yPosition) } });
      }
    }
  };
  
  const mouseClick = (e) => {

    if (e.target !== elementRef.current && !elementRef.current.contains(e.target)) {
      return;
    }

    if (fetchedResults) {
      return
    }

    const boundingRect = elementRef.current.getBoundingClientRect();
    const xPosition = e.clientX - boundingRect.left;
    const yPosition = e.clientY - boundingRect.top;
    console.log(xPosition,yPosition)
    if (imageId !== ''){
      if (startingPoint == null) {
        setStartingPoint({ x: parseInt(xPosition), y: parseInt(yPosition) });
      } else if (endingPoint == null) {
        setEndingingPoint({ id: currentFrame, starting: startingPoint, ending: { x: parseInt(xPosition) , y: parseInt(yPosition) } });
      }
    }
    
  };

  const handleSubmit = async (e) => {
    const message = {
      id: currentFrame,
      finalPoints: endingPoint,
      finalPoints2: endingPoint2,
      id2: currentFrame2,
      selectedFile: selectedFile.name,
      selectedFile2: selectedFile2.name
    };
    console.log(message);
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("file2", selectedFile2);
    formData.append("message", JSON.stringify(message));
  
    try {
      const response = await fetch('http://127.0.0.1:8000/upload-dicom/', {
        method: 'POST',
        body: formData
        // headers are automatically set for FormData
      });
  
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
  
      const data = await response.json();
      setImageSrc(`data:image/jpeg;base64,${data.image}`);
      setImageSrc2(`data:image/jpeg;base64,${data.image2}`);
      setRImageSRC(`data:image/jpeg;base64,${data.diameterArray}`);
      setRImageSRC2(`data:image/jpeg;base64,${data.diameterArray2}`);
      setContour(data.contour)
      setContour2(data.contour2)
      setfetchedResults(true)
      
    } catch (error) {
      console.error('Error posting data to the server:', error);
    }
  };
  
  const handleDragMove = (index, e) => {
    const newContour = contour.slice();
    newContour[index] = [e.target.x(), e.target.y()];
    setContour(newContour);
};

const handleDragMove2 = (index, e) => {
  const newContour = contour.slice();
  newContour[index] = [e.target.x(), e.target.y()];
  setContour2(newContour);
};

  return (
    <div className="dicom-viewer-container">  
      <div className="viewer-section">
        <div className="dicom-image-container">
          <div className="image-viewer" ref={elementRef} onClick={mouseClick}>
            {endingPoint && <CircleDrawer x={endingPoint.ending.x} y={endingPoint.ending.y} radius={5} />}
            {startingPoint && <CircleDrawer x={startingPoint.x} y={startingPoint.y} radius={5} />}
            {fetchedResults ?   <Stage width={window.innerWidth} height={window.innerHeight} style={{position:"absolute"}}>
            <Layer>
                <Line
                    points={contour.flat()}
                    stroke="red"
                    strokeWidth={0.5}
                    tension={0.5}
                    closed
                />
                {contour.map((point, i) => (
                    <Circle
                        key={i}
                        x={point[0]}
                        y={point[1]}
                        radius={2}
                        opacity={0.1}
                        fill="blue"
                        draggable
                        onDragMove={(e) => handleDragMove(i, e)}
                        onClick={() => setSelectedPointIndex(i)}
                        stroke={selectedPointIndex === i ? 'black' : 'blue'}
                        strokeWidth={2}
                    />
                ))}
            </Layer>
        </Stage> : <></>}
           
          </div>
          <div className="frame-controls">
            {totalFrames > 1 && (
              <>
                <button className="frame-button" onClick={() => changeFrame(-1)}>Previous Frame</button>
                <button className="frame-button" onClick={() => changeFrame(1)}>Next Frame</button>
                <div className="frame-info">{currentFrame + 1}</div>
                <div className="angle-info">{angles.primary} {angles.secondary}</div>
              </>
            )}
            <FileSelector filesList={filesList} setSelectedFile={setSelectedFile} />
          </div>
        </div>

        <div className="dicom-image-container">
          <div className="image-viewer" ref={elementRef2} onClick={mouseClick2}>
            {startingPoint2 && startingPoint? <InfiniteLineDrawer2 x1={startingPoint2.x} y1={startingPoint2.y} angle={finalAngle}/>:<></>}
            {startingPoint ? <InfiniteLineDrawer x1={startingPoint.x} y1={startingPoint.y} angle={finalAngle}/>:<></>}
            {endingPoint2 && <CircleDrawer x={endingPoint2.ending.x} y={endingPoint2.ending.y} radius={5} />}
            {startingPoint2 && <CircleDrawer x={startingPoint2.x} y={startingPoint2.y} radius={5} />}
            {fetchedResults ? <Stage width={window.innerWidth} height={window.innerHeight} style={{position:"absolute"}}>
            <Layer>
                <Line
                    points={contour2.flat()}
                    stroke="red"
                    strokeWidth={0.5}
                    tension={0.5}
                    closed
                />
                {contour2.map((point, i) => (
                    <Circle
                        key={i}
                        x={point[0]}
                        y={point[1]}
                        radius={2}
                        opacity={0.1}
                        fill="blue"
                        draggable
                        onDragMove={(e) => handleDragMove2(i, e)}
                        onClick={() => setSelectedPointIndex2(i)}
                        stroke={selectedPointIndex2 === i ? 'black' : 'blue'}
                        strokeWidth={2}
                    />
                ))}
            </Layer>
        </Stage>          : <></>}
            </div>
          <div className="frame-controls">
            {totalFrames2 > 1 && (
              <>
                <button className="frame-button" onClick={() => changeFrame2(-1)}>Previous Frame</button>
                <button className="frame-button" onClick={() => changeFrame2(1)}>Next Frame</button>
                <div className="frame-info">{currentFrame2 + 1}</div>
                <div className="angle-info">{angles2.primary} {angles2.secondary}</div>
              </>
            )}
            <FileSelector filesList={filesList2} setSelectedFile={setSelectedFile2} />
          </div>
        </div>
      </div>

      <div className="bottom-section">
        <h1>Angle: {finalAngle}</h1>
        <div className="drop-zone" onDrop={(e) => {
          handleDrop(e);
          handleDrop2(e);
        }} 
        onDragOver={handleDragOver}>
          Drop DICOM file here
        </div>
        <button className="analysis-button" onClick={handleSubmit}>Start Analysis</button>
      </div>
      
      <div>
      <h1>Results Section</h1>
      </div>

      <div style={{display:'flex', position:'relative', flex:1}}>
        <img src={RImageSRC}/>
        <img src={RImageSRC2} />
      </div>

    </div>
  );

};

const FileSelector = ({ filesList,setSelectedFile }) => (
  filesList.length > 0 && (
    <select className="file-selector" onChange={(e) => setSelectedFile(filesList[e.target.value])}>
      {filesList.map((file, index) => (
        <option key={index} value={index}>{file.name}</option>
      ))}
    </select>
  )
);


export default DicomViewer;