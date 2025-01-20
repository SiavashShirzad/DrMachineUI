import React, { useState, useRef, useEffect } from 'react';
import cornerstone from 'cornerstone-core';
import cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader';
import dicomParser from 'dicom-parser';
import './DicomViewer.css';
import axios from 'axios';

// Initialize Cornerstone WADO Image Loader
cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
cornerstoneWADOImageLoader.external.dicomParser = dicomParser;
cornerstoneWADOImageLoader.webWorkerManager.initialize();

// Axios instances
export const api = axios.create({
  baseURL: 'http://185.208.175.49:8666/api/v1/',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `jwt ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

export const api2 = axios.create({
  baseURL: 'http://185.208.175.49:8666/media/',
  headers: { 'Content-Type': 'application/json' },
});

export const setAuthToken2 = (token) => {
  if (token) {
    api2.defaults.headers.common['Authorization'] = `jwt ${token}`;
  } else {
    delete api2.defaults.headers.common['Authorization'];
  }
};

const DicomViewer = () => {
  const getStatusText = (status) => {
    switch (status) {
      case 0:
        return 'Failed';
      case 1:
        return 'Error';
      case 2:
        return 'Pending';
      case 3:
        return 'Completed';
      default:
        return 'Unknown';
    }
  };

  // State variables
  const [filesList, setFilesList] = useState([]);
  const [inferenceList, setInferenceList] = useState([]);

  // For pre-inference manual marking
  const [selectedFile1, setSelectedFile1] = useState(null);
  const [selectedFile2, setSelectedFile2] = useState(null);

  const [points1, setPoints1] = useState([]);
  const [points2, setPoints2] = useState([]);

  const [imageId1, setImageId1] = useState('');
  const [imageId2, setImageId2] = useState('');

  const [totalFrames1, setTotalFrames1] = useState(1);
  const [totalFrames2, setTotalFrames2] = useState(1);

  const [currentFrame1, setCurrentFrame1] = useState(0);
  const [currentFrame2, setCurrentFrame2] = useState(0);

  const viewerRef1 = useRef(null);
  const viewerRef2 = useRef(null);
  const overlayRef1 = useRef(null);
  const overlayRef2 = useRef(null);

  const [apiResults, setApiResults] = useState(null);

  // State for dropdown drawer
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedInferenceData, setSelectedInferenceData] = useState(null);

  // Polling interval ID
  const pollingIntervalRef = useRef(null);

  // States for paths and contours
  const [paths1, setPaths1] = useState([]);
  const [contours1, setContours1] = useState([]);
  const [paths2, setPaths2] = useState([]);
  const [contours2, setContours2] = useState([]);

  // State variables for image dimensions (used for scaling)
  const [imageWidth1, setImageWidth1] = useState(0);
  const [imageHeight1, setImageHeight1] = useState(0);
  const [imageWidth2, setImageWidth2] = useState(0);
  const [imageHeight2, setImageHeight2] = useState(0);

  // Editing states
  const [editingContour, setEditingContour] = useState(false);

  // Dragging logic
  const [draggingPointIndex, setDraggingPointIndex] = useState(null);
  const [draggingViewer, setDraggingViewer] = useState(null);

  // The single highlighted point (only shown when user clicks near line)
  const [highlightedPointIndex1, setHighlightedPointIndex1] = useState(null);
  const [highlightedPointIndex2, setHighlightedPointIndex2] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('access');
    if (token) {
      setAuthToken(token);
      setAuthToken2(token);
    }
  }, []);

  // Fetch DICOM files
  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const response = await api.get('/registry/dicom-file/');
        setFilesList(response.data.results);
      } catch (error) {
        console.error('Error fetching DICOM files:', error);
      }
    };
    fetchFiles();
  }, []);

  // Fetch Inference List + polling
  useEffect(() => {
    const fetchInferences = async () => {
      try {
        const response = await api.get('/inference/');
        setInferenceList(response.data.results);
      } catch (error) {
        console.error('Error fetching inference list:', error);
      }
    };
    fetchInferences();

    pollingIntervalRef.current = setInterval(fetchInferences, 5000); // Poll every 5 seconds

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const fetchAndLoadDICOM = async (fileName, viewerRef) => {
    try {
      const response = await api2.get(`${fileName}.dcm`, { responseType: 'arraybuffer' });
      const blob = new Blob([response.data], { type: 'application/dicom' });
      const file = new File([blob], fileName);

      const imageId = cornerstoneWADOImageLoader.wadouri.fileManager.add(file);
      cornerstone.enable(viewerRef.current);
      const image = await cornerstone.loadImage(imageId);
      const frames = parseInt(image.data.string('x00280008')) || 1; // Multi-frame DICOM tag
      return { imageId, frames };
    } catch (error) {
      console.error(`Error loading DICOM file ${fileName}:`, error);
      return { imageId: '', frames: 1 };
    }
  };

  const displayFrame = async (
    imageId,
    viewerRef,
    frameIndex,
    setImageWidth,
    setImageHeight
  ) => {
    try {
      const frameImageId = `${imageId}?frame=${frameIndex}`;
      const image = await cornerstone.loadImage(frameImageId);
      cornerstone.displayImage(viewerRef.current, image);

      // Set canvas size to match viewer's size
      const canvasRef = viewerRef === viewerRef1 ? overlayRef1 : overlayRef2;
      const canvas = canvasRef.current;
      if (canvas && image) {
        const viewerWidth = viewerRef.current.clientWidth;
        const viewerHeight = viewerRef.current.clientHeight;

        canvas.width = viewerWidth;
        canvas.height = viewerHeight;

        // Store image dimensions
        setImageWidth(image.width);
        setImageHeight(image.height);
      }
    } catch (error) {
      console.error(`Error displaying frame ${frameIndex} for imageId ${imageId}:`, error);
    }
  };

  const handleScroll = (
    e,
    currentFrame,
    setCurrentFrame,
    totalFrames,
    imageId,
    viewerRef
  ) => {
    e.preventDefault();
    // You can block scrolling if editingContour is true, or allow it:
    // if (editingContour) return;

    const direction = e.deltaY > 0 ? 1 : -1;
    const newFrame = currentFrame + direction;

    if (newFrame >= 0 && newFrame < totalFrames) {
      setCurrentFrame(newFrame);
      displayFrame(
        imageId,
        viewerRef,
        newFrame,
        viewerRef === viewerRef1 ? setImageWidth1 : setImageWidth2,
        viewerRef === viewerRef1 ? setImageHeight1 : setImageHeight2
      );
    }
  };

  // --- START & END POINTS HANDLING (PRE-INFERENCE) ---
  const handleLeftClick = (e, points, setPoints) => {
    // If an inference is selected (editingContour = true), do NOT set start/end.
    if (editingContour) return;

    if (points.length >= 2) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);

    setPoints([...points, { x, y }]);
  };

  const handleRightClick = (e, points, setPoints) => {
    // If an inference is selected (editingContour = true), do NOT set start/end.
    if (editingContour) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    if (points.length > 0) setPoints(points.slice(0, -1));
  };
  // --- END START & END POINTS HANDLING ---

  const createInstances = () => {
    const instances = [
      {
        dicom_file_id: selectedFile1,
        frame_number: currentFrame1,
        start_point: [points1[0].x, points1[0].y],
        end_point: [points1[1].x, points1[1].y],
      },
      {
        dicom_file_id: selectedFile2,
        frame_number: currentFrame2,
        start_point: [points2[0].x, points2[0].y],
        end_point: [points2[1].x, points2[1].y],
      },
    ];
    return instances;
  };

  const handleRunInference = async () => {
    if (points1.length === 2 && points2.length === 2) {
      const instances = createInstances();

      try {
        const response = await api.post('/inference/service/angiovision/run/', {
          instances,
        });
        setApiResults(response.data);
      } catch (error) {
        console.error('Error posting instances:', error);
      }
    }
  };

  // Clicking on an inference card
  const handleCardClick = async (id) => {
    try {
      const response = await api.get(`/inference/${id}/`);
      const inferenceData = response.data;
      setSelectedInferenceData(inferenceData);

      const params = inferenceData.params;
      const results = inferenceData.results;

      if (params.length >= 2 && results.length >= 2) {
        const param1 = params[0];
        const param2 = params[1];
        const result1 = results[0];
        const result2 = results[1];

        // Load both DICOM files
        const { imageId: loadedImageId1, frames: loadedFrames1 } = await fetchAndLoadDICOM(
          param1.dicom_file_id,
          viewerRef1
        );
        const { imageId: loadedImageId2, frames: loadedFrames2 } = await fetchAndLoadDICOM(
          param2.dicom_file_id,
          viewerRef2
        );

        // Update state for Viewer 1
        setSelectedFile1(param1.dicom_file_id);
        setImageId1(loadedImageId1);
        setTotalFrames1(loadedFrames1);
        setCurrentFrame1(param1.frame_number);
        await displayFrame(
          loadedImageId1,
          viewerRef1,
          param1.frame_number,
          setImageWidth1,
          setImageHeight1
        );
        setPoints1([]); // Clear existing start/end points

        // Update state for Viewer 2
        setSelectedFile2(param2.dicom_file_id);
        setImageId2(loadedImageId2);
        setTotalFrames2(loadedFrames2);
        setCurrentFrame2(param2.frame_number);
        await displayFrame(
          loadedImageId2,
          viewerRef2,
          param2.frame_number,
          setImageWidth2,
          setImageHeight2
        );
        setPoints2([]); // Clear existing start/end points

        // Extract & set paths and contours
        setPaths1(result1.metadata.path_1 || []);
        setContours1(result1.metadata.new_contour_1 || []);
        setPaths2(result2.metadata.path_1 || []);
        setContours2(result2.metadata.new_contour_1 || []);

        // Once an inference is selected, we allow contour editing
        setEditingContour(true);

        // Reset highlight / dragging
        setDraggingPointIndex(null);
        setDraggingViewer(null);
        setHighlightedPointIndex1(null);
        setHighlightedPointIndex2(null);
      }

      // Close the inference list drawer
      setIsDrawerOpen(false);
    } catch (error) {
      console.error('Error fetching inference data:', error);
    }
  };

  // --------- Drawing Overlays (Paths + Contours) ---------
  const drawOverlay = (
    canvasRef,
    paths,
    contours,
    imageWidth,
    imageHeight,
    viewerKey
  ) => {
    const canvas = canvasRef?.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    // Clear previous
    context.clearRect(0, 0, canvas.width, canvas.height);

    if (!paths && !contours) return;
    if (imageWidth === 0 || imageHeight === 0) return;

    // Canvas to image scaling
    const scaleX = canvas.width / 1024;
    const scaleY = canvas.height / 1024;

    // Draw path (just as lines)
    if (paths && paths.length > 1) {
      context.strokeStyle = 'yellow';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(paths[0][1] * scaleY, paths[0][0] * scaleX);
      for (let i = 1; i < paths.length; i++) {
        context.lineTo(paths[i][1] * scaleY, paths[i][0] * scaleX);
      }
      context.stroke();
    }

    // Draw contour line (without showing all points)
    if (contours && contours.length > 1) {
      context.strokeStyle = 'green';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(contours[0][1] * scaleY, contours[0][0] * scaleX);
      for (let i = 1; i < contours.length; i++) {
        context.lineTo(contours[i][1] * scaleY, contours[i][0] * scaleX);
      }
      context.stroke();
    }

    // Draw the *single highlighted* point if any
    if (viewerKey === 'viewer1' && highlightedPointIndex1 !== null) {
      const pt = contours[highlightedPointIndex1];
      if (pt) {
        const cx = pt[1] * scaleY;
        const cy = pt[0] * scaleX;
        // Draw a small circle
        context.fillStyle = 'rgba(0,255,0,0.8)';
        context.beginPath();
        context.arc(cx, cy, 4, 0, 2 * Math.PI);
        context.fill();
      }
    } else if (viewerKey === 'viewer2' && highlightedPointIndex2 !== null) {
      const pt = contours[highlightedPointIndex2];
      if (pt) {
        const cx = pt[1] * scaleY;
        const cy = pt[0] * scaleX;
        // Draw a small circle
        context.fillStyle = 'rgba(0,255,0,0.8)';
        context.beginPath();
        context.arc(cx, cy, 4, 0, 2 * Math.PI);
        context.fill();
      }
    }
  };

  // Re-draw overlays when data changes
  useEffect(() => {
    if (editingContour && selectedInferenceData) {
      drawOverlay(overlayRef1, paths1, contours1, imageWidth1, imageHeight1, 'viewer1');
      drawOverlay(overlayRef2, paths2, contours2, imageWidth2, imageHeight2, 'viewer2');
    }
  }, [
    paths1,
    contours1,
    paths2,
    contours2,
    imageWidth1,
    imageHeight1,
    imageWidth2,
    imageHeight2,
    editingContour,
    selectedInferenceData,
  ]);

  useEffect(() => {
    const handleResize = () => {
      if (editingContour && selectedInferenceData) {
        drawOverlay(overlayRef1, paths1, contours1, imageWidth1, imageHeight1, 'viewer1');
        drawOverlay(overlayRef2, paths2, contours2, imageWidth2, imageHeight2, 'viewer2');
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [
    editingContour,
    selectedInferenceData,
    paths1,
    contours1,
    paths2,
    contours2,
    imageWidth1,
    imageHeight1,
    imageWidth2,
    imageHeight2,
  ]);

  // ---------------------------
  // CONTOUR EDITING LOGIC
  // ---------------------------

  /**
   * convertCanvasToContourCoords:
   * Convert from canvas (x,y) to your contour coordinate system ([row, col]).
   */
  const convertCanvasToContourCoords = (canvasX, canvasY, canvas) => {
    if (!canvas) return null;
    // Suppose your original data is in a 1024x1024 grid:
    const scaleX = canvas.width / 1024; // how many canvas pixels per "row"
    const scaleY = canvas.height / 1024; // how many canvas pixels per "col"
    const row = canvasY / scaleX;
    const col = canvasX / scaleY;
    return [Math.round(row), Math.round(col)];
  };

  /**
   * findClosestContourPoint:
   * Return the index of the closest point in "contour" if within threshold, else -1
   */
  const findClosestContourPoint = (canvasX, canvasY, contour, canvas, threshold = 10) => {
    let closestIndex = -1;
    let minDist = Infinity;
    if (!contour || contour.length === 0) return -1;

    const scaleX = canvas.width / 1024;
    const scaleY = canvas.height / 1024;

    for (let i = 0; i < contour.length; i++) {
      const pt = contour[i];
      // Convert contour pt to canvas coords
      const px = pt[1] * scaleY;
      const py = pt[0] * scaleX;
      const dx = px - canvasX;
      const dy = py - canvasY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) {
        minDist = dist;
        closestIndex = i;
      }
    }
    return minDist <= threshold ? closestIndex : -1;
  };

  /**
   * handleCanvasMouseDown:
   * - If click is near a point, highlight it and begin dragging
   */
  const handleCanvasMouseDown = (e, viewer) => {
    if (!editingContour) return; // Only if we are editing
    const canvasRef = viewer === 'viewer1' ? overlayRef1 : overlayRef2;
    const contour = viewer === 'viewer1' ? contours1 : contours2;

    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    // 1) Find if user clicked near an existing point
    const idx = findClosestContourPoint(canvasX, canvasY, contour, canvasRef.current, 10);
    if (idx !== -1) {
      // Start dragging
      setDraggingPointIndex(idx);
      setDraggingViewer(viewer);

      // Highlight the chosen point
      if (viewer === 'viewer1') {
        setHighlightedPointIndex1(idx);
      } else {
        setHighlightedPointIndex2(idx);
      }
    }
  };

  /**
   * handleCanvasMouseMove:
   * - If dragging, update that point (and optionally move adjacent points).
   */
  const handleCanvasMouseMove = (e) => {
    if (draggingPointIndex == null || !editingContour) return;

    const viewer = draggingViewer;
    const canvasRef = viewer === 'viewer1' ? overlayRef1 : overlayRef2;
    let contourState = viewer === 'viewer1' ? contours1 : contours2;

    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    // Convert mouse to contour coords
    const newCoords = convertCanvasToContourCoords(canvasX, canvasY, canvasRef.current);
    if (!newCoords) return;

    const idx = draggingPointIndex;

    // Update the point
    // "Move the line close to it" => we can move the adjacent points a bit as well:
    const updatedContour = [...contourState];
    updatedContour[idx] = newCoords;

    // OPTIONAL: Move neighbors slightly for smoothing
    const neighborRadius = 1; // how many neighbors to move
    for (let n = 1; n <= neighborRadius; n++) {
      if (idx - n >= 0) {
        // push left neighbor closer by some fraction
        updatedContour[idx - n] = blendPoints(
          updatedContour[idx - n],
          newCoords,
          0.2 / n // fraction
        );
      }
      if (idx + n < updatedContour.length) {
        // push right neighbor closer by some fraction
        updatedContour[idx + n] = blendPoints(
          updatedContour[idx + n],
          newCoords,
          0.2 / n
        );
      }
    }

    // Update the relevant state
    if (viewer === 'viewer1') {
      setContours1(updatedContour);
    } else {
      setContours2(updatedContour);
    }
  };

  // Simple helper: blend two [row,col] points by fraction alpha
  const blendPoints = (ptA, ptB, alpha) => {
    // linear interpolation
    const row = Math.round(ptA[0] + alpha * (ptB[0] - ptA[0]));
    const col = Math.round(ptA[1] + alpha * (ptB[1] - ptA[1]));
    return [row, col];
  };

  /**
   * handleCanvasMouseUp:
   * - End dragging
   * - Optionally hide the highlight again
   */
  const handleCanvasMouseUp = () => {
    setDraggingPointIndex(null);
    setDraggingViewer(null);

    // Hide highlight if you'd like to remove it after each drag
    // Otherwise, you can leave it
    setHighlightedPointIndex1(null);
    setHighlightedPointIndex2(null);
  };

  return (
    <div className="dicom-viewer-container">
      {/* Dropdown Drawer */}
      <div className={`dropdown-drawer ${isDrawerOpen ? 'open' : ''}`}>
        <h3>Inference List</h3>
        {inferenceList.length === 0 ? (
          <p>No inferences available.</p>
        ) : (
          <div className="cards-container">
            {inferenceList.map((inference) => (
              <div
                key={inference.id}
                className="inference-card"
                onClick={() => handleCardClick(inference.id)}
              >
                <div className="service-name">{inference.service.name}</div>
                <div className="user-date">
                  <span>{inference.user.username}</span>
                  <span>{new Date(inference.created_at).toLocaleString()}</span>
                </div>
                <div className="status-container">
                  <div className={`status-circle status-${inference.status}`}></div>
                  <span className="status-text">{getStatusText(inference.status)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Viewer 1 */}
      <div className="viewer-section">
        <h3>Viewer 1</h3>
        <select
          className="file-selector"
          onChange={async (e) => {
            const fileId = e.target.value;
            if (fileId) {
              const { imageId, frames } = await fetchAndLoadDICOM(fileId, viewerRef1);
              setSelectedFile1(fileId);
              setImageId1(imageId);
              setTotalFrames1(frames);
              setCurrentFrame1(0);
              await displayFrame(imageId, viewerRef1, 0, setImageWidth1, setImageHeight1);
              // Reset points and overlays
              setPoints1([]);
              setPaths1([]);
              setContours1([]);
              setEditingContour(false);
              setSelectedInferenceData(null);
            } else {
              cornerstone.disable(viewerRef1.current);
              setSelectedFile1(null);
              setImageId1('');
              setTotalFrames1(1);
              setCurrentFrame1(0);
              setPoints1([]);
              setPaths1([]);
              setContours1([]);
            }
          }}
          value={selectedFile1 || ''}
        >
          <option value="">Select a file</option>
          {filesList.map((file, idx) => (
            <option key={idx} value={file.id}>
              {file.id}
            </option>
          ))}
        </select>
        <div
          ref={viewerRef1}
          className="dicom-image-container"
          onWheel={(e) =>
            handleScroll(e, currentFrame1, setCurrentFrame1, totalFrames1, imageId1, viewerRef1)
          }
          onMouseDown={(e) => {
            if (editingContour && selectedInferenceData) {
              handleCanvasMouseDown(e, 'viewer1');
            } else {
              handleLeftClick(e, points1, setPoints1);
            }
          }}
          onContextMenu={(e) => {
            if (editingContour && selectedInferenceData) {
              e.preventDefault(); // do nothing
            } else {
              handleRightClick(e, points1, setPoints1);
            }
          }}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
        >
          <canvas ref={overlayRef1} className="overlay-canvas" />
          {/* If an inference is selected, do NOT show start/end points */}
          {!editingContour &&
            points1.map((point, index) => (
              <div
                key={index}
                className={index === 0 ? 'start-point' : 'end-point'}
                style={{ top: point.y - 4, left: point.x - 4 }}
                title={`${
                  index === 0 ? 'Start Point' : 'End Point'
                }: (${point.x}, ${point.y})`}
              ></div>
            ))}
        </div>
        <div className="info-container">
          <p className="frame-info">
            Current Frame: {currentFrame1 + 1} / {totalFrames1}
          </p>
          {!editingContour && (
            <div className="coordinates">
              <p>
                Start Point:{' '}
                {points1[0] ? `(${points1[0].x}, ${points1[0].y})` : 'Not Set'}
              </p>
              <p>
                End Point:{' '}
                {points1[1] ? `(${points1[1].x}, ${points1[1].y})` : 'Not Set'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Viewer 2 */}
      <div className="viewer-section">
        <h3>Viewer 2</h3>
        <select
          className="file-selector"
          onChange={async (e) => {
            const fileId = e.target.value;
            if (fileId) {
              const { imageId, frames } = await fetchAndLoadDICOM(fileId, viewerRef2);
              setSelectedFile2(fileId);
              setImageId2(imageId);
              setTotalFrames2(frames);
              setCurrentFrame2(0);
              await displayFrame(imageId, viewerRef2, 0, setImageWidth2, setImageHeight2);
              // Reset points and overlays
              setPoints2([]);
              setPaths2([]);
              setContours2([]);
              setEditingContour(false);
              setSelectedInferenceData(null);
            } else {
              cornerstone.disable(viewerRef2.current);
              setSelectedFile2(null);
              setImageId2('');
              setTotalFrames2(1);
              setCurrentFrame2(0);
              setPoints2([]);
              setPaths2([]);
              setContours2([]);
            }
          }}
          value={selectedFile2 || ''}
        >
          <option value="">Select a file</option>
          {filesList.map((file, idx) => (
            <option key={idx} value={file.id}>
              {file.id}
            </option>
          ))}
        </select>
        <div
          ref={viewerRef2}
          className="dicom-image-container"
          onWheel={(e) =>
            handleScroll(e, currentFrame2, setCurrentFrame2, totalFrames2, imageId2, viewerRef2)
          }
          onMouseDown={(e) => {
            if (editingContour && selectedInferenceData) {
              handleCanvasMouseDown(e, 'viewer2');
            } else {
              handleLeftClick(e, points2, setPoints2);
            }
          }}
          onContextMenu={(e) => {
            if (editingContour && selectedInferenceData) {
              e.preventDefault();
            } else {
              handleRightClick(e, points2, setPoints2);
            }
          }}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
        >
          <canvas ref={overlayRef2} className="overlay-canvas" />
          {/* If an inference is selected, do NOT show start/end points */}
          {!editingContour &&
            points2.map((point, index) => (
              <div
                key={index}
                className={index === 0 ? 'start-point' : 'end-point'}
                style={{ top: point.y - 4, left: point.x - 4 }}
                title={`${
                  index === 0 ? 'Start Point' : 'End Point'
                }: (${point.x}, ${point.y})`}
              ></div>
            ))}
        </div>
        <div className="info-container">
          <p className="frame-info">
            Current Frame: {currentFrame2 + 1} / {totalFrames2}
          </p>
          {!editingContour && (
            <div className="coordinates">
              <p>
                Start Point:{' '}
                {points2[0] ? `(${points2[0].x}, ${points2[0].y})` : 'Not Set'}
              </p>
              <p>
                End Point:{' '}
                {points2[1] ? `(${points2[1].x}, ${points2[1].y})` : 'Not Set'}
              </p>
            </div>
          )}
        </div>
      </div>

      <div>
        {/* Inference Button */}
        <div
          className="button-container"
          style={{ marginTop: '20px', textAlign: 'center' }}
        >
          <button
            onClick={handleRunInference}
            disabled={points1.length < 2 || points2.length < 2 || editingContour}
            style={{
              padding: '10px 20px',
              fontSize: '1rem',
              borderRadius: '5px',
              backgroundColor:
                points1.length < 2 || points2.length < 2 || editingContour
                  ? '#ccc'
                  : '#007bff',
              color: '#fff',
              cursor:
                points1.length < 2 || points2.length < 2 || editingContour
                  ? 'not-allowed'
                  : 'pointer',
              border: 'none',
            }}
          >
            Run Inference
          </button>
        </div>
        {/* Dropdown Drawer Toggle Button */}
        <div
          className="drawer-toggle-container"
          style={{ textAlign: 'right', padding: '10px' }}
        >
          <button
            onClick={() => setIsDrawerOpen(!isDrawerOpen)}
            style={{
              padding: '10px 20px',
              fontSize: '1rem',
              borderRadius: '5px',
              backgroundColor: '#28a745',
              color: '#fff',
              cursor: 'pointer',
              border: 'none',
            }}
          >
            Inference List
          </button>
        </div>
      </div>
    </div>
  );
};

export default DicomViewer;
