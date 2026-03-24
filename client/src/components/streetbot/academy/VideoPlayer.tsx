/**
 * Enhanced Video Player Component.
 * Tracks progress, supports bookmarks and notes.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  getVideoProgress,
  updateVideoProgress,
  createBookmark,
  getBookmarks,
  deleteBookmark,
  createNote,
  getNotes,
  deleteNote,
  VideoBookmark,
  VideoNote,
} from './api/video-progress';
import { getLessonCaptions, Caption } from './api/captions';
import { getOrCreateUserId } from './api/userId';

interface VideoPlayerProps {
  lessonId: string;
  videoUrl: string;
  title?: string;
  onComplete?: () => void;
  className?: string;
}

export function VideoPlayer({
  lessonId,
  videoUrl,
  title,
  onComplete,
  className = '',
}: VideoPlayerProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [bookmarks, setBookmarks] = useState<VideoBookmark[]>([]);
  const [notes, setNotes] = useState<VideoNote[]>([]);
  const [showBookmarkPanel, setShowBookmarkPanel] = useState(false);
  const [showNotePanel, setShowNotePanel] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [activeCaption, setActiveCaption] = useState<string | null>(null);
  const [showCaptionMenu, setShowCaptionMenu] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressUpdateRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setUserId(getOrCreateUserId());
  }, []);

  // Load saved progress
  useEffect(() => {
    const loadProgress = async () => {
      if (!userId) return;
      const savedProgress = await getVideoProgress(lessonId, userId);
      if (savedProgress && videoRef.current) {
        videoRef.current.currentTime = savedProgress.current_time;
        setPlaybackSpeed(savedProgress.playback_speed);
        videoRef.current.playbackRate = savedProgress.playback_speed;
      }
    };
    loadProgress();
  }, [lessonId, userId]);

  // Load bookmarks and notes
  useEffect(() => {
    const loadData = async () => {
      if (!userId) return;
      const [loadedBookmarks, loadedNotes] = await Promise.all([
        getBookmarks(lessonId, userId),
        getNotes(lessonId, userId),
      ]);
      setBookmarks(loadedBookmarks);
      setNotes(loadedNotes);
    };
    loadData();
  }, [lessonId, userId]);

  // Load captions
  useEffect(() => {
    const loadCaptions = async () => {
      try {
        const loadedCaptions = await getLessonCaptions(lessonId);
        setCaptions(loadedCaptions);
        // Set default caption as active
        const defaultCaption = loadedCaptions.find((c) => c.is_default);
        if (defaultCaption) {
          setActiveCaption(defaultCaption.language_code);
        }
      } catch (error) {
        console.error('Failed to load captions:', error);
      }
    };
    loadCaptions();
  }, [lessonId]);

  // Save progress periodically
  const saveProgress = useCallback(async () => {
    if (!userId || !videoRef.current) return;
    try {
      await updateVideoProgress(
        lessonId,
        {
          current_time: videoRef.current.currentTime,
          duration: videoRef.current.duration,
          playback_speed: playbackSpeed,
        },
        userId,
        videoUrl
      );
    } catch (error) {
      console.error('Failed to save progress:', error);
    }
  }, [lessonId, userId, videoUrl, playbackSpeed]);

  // Set up periodic progress saving
  useEffect(() => {
    if (isPlaying) {
      progressUpdateRef.current = setInterval(saveProgress, 10000); // Every 10 seconds
    }
    return () => {
      if (progressUpdateRef.current) {
        clearInterval(progressUpdateRef.current);
      }
    };
  }, [isPlaying, saveProgress]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      const progressPercent = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(progressPercent);

      // Check for completion (90%)
      if (progressPercent >= 90 && onComplete) {
        onComplete();
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = (parseFloat(e.target.value) / 100) * duration;
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleSpeedChange = (speed: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
      setPlaybackSpeed(speed);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      videoRef.current?.parentElement?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleAddBookmark = async () => {
    if (!userId) return;
    const bookmark = await createBookmark(
      lessonId,
      { timestamp: currentTime, title: `Bookmark at ${formatTime(currentTime)}` },
      userId
    );
    setBookmarks([...bookmarks, bookmark]);
  };

  const handleDeleteBookmark = async (bookmarkId: string) => {
    await deleteBookmark(bookmarkId);
    setBookmarks(bookmarks.filter((b) => b.id !== bookmarkId));
  };

  const handleAddNote = async () => {
    if (!userId || !newNote.trim()) return;
    const note = await createNote(
      lessonId,
      { timestamp: currentTime, content: newNote },
      userId
    );
    setNotes([...notes, note]);
    setNewNote('');
  };

  const handleDeleteNote = async (noteId: string) => {
    await deleteNote(noteId);
    setNotes(notes.filter((n) => n.id !== noteId));
  };

  const jumpToTimestamp = (timestamp: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timestamp;
      setCurrentTime(timestamp);
    }
  };

  // Hide controls after inactivity
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  return (
    <div className={`relative bg-black rounded-lg overflow-hidden ${className}`} onMouseMove={handleMouseMove}>
      {/* Video Element */}
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full aspect-video"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => saveProgress()}
        onClick={handlePlayPause}
        crossOrigin="anonymous"
      >
        {/* Caption Tracks */}
        {captions.map((caption) => (
          <track
            key={caption.id}
            kind={caption.caption_type === 'captions' ? 'captions' : 'subtitles'}
            src={caption.vtt_url}
            srcLang={caption.language_code}
            label={caption.label || caption.language_name}
            default={caption.is_default}
          />
        ))}
      </video>

      {/* Bookmarks on progress bar */}
      <div className="absolute bottom-16 left-0 right-0 px-4">
        {bookmarks.map((bookmark) => (
          <div
            key={bookmark.id}
            className="absolute w-2 h-2 bg-yellow-400 rounded-full cursor-pointer transform -translate-x-1/2"
            style={{ left: `${(bookmark.timestamp / duration) * 100}%` }}
            onClick={() => jumpToTimestamp(bookmark.timestamp)}
            title={bookmark.title || formatTime(bookmark.timestamp)}
          />
        ))}
      </div>

      {/* Controls Overlay */}
      <div
        className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Title */}
        {title && (
          <div className="absolute top-4 left-4 text-white font-medium text-lg">
            {title}
          </div>
        )}

        {/* Center Play Button */}
        {!isPlaying && (
          <button
            onClick={handlePlayPause}
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
          >
            <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        )}

        {/* Bottom Controls */}
        <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
          {/* Progress Bar */}
          <div className="flex items-center gap-2">
            <span className="text-white text-sm">{formatTime(currentTime)}</span>
            <input
              type="range"
              min="0"
              max="100"
              value={progress}
              onChange={handleSeek}
              className="flex-1 h-1 bg-gray-600 rounded-full appearance-none cursor-pointer"
            />
            <span className="text-white text-sm">{formatTime(duration)}</span>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Play/Pause */}
              <button onClick={handlePlayPause} className="text-white hover:text-purple-400">
                {isPlaying ? (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              {/* Volume */}
              <div className="flex items-center gap-2">
                <button onClick={toggleMute} className="text-white hover:text-purple-400">
                  {isMuted || volume === 0 ? (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                    </svg>
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={volume}
                  onChange={handleVolumeChange}
                  className="w-20 h-1 bg-gray-600 rounded-full appearance-none cursor-pointer"
                />
              </div>

              {/* Speed */}
              <select
                value={playbackSpeed}
                onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                className="bg-transparent text-white text-sm border border-white/30 rounded px-2 py-1"
              >
                <option value="0.5">0.5x</option>
                <option value="0.75">0.75x</option>
                <option value="1">1x</option>
                <option value="1.25">1.25x</option>
                <option value="1.5">1.5x</option>
                <option value="2">2x</option>
              </select>
            </div>

            <div className="flex items-center gap-4">
              {/* Bookmark */}
              <button
                onClick={handleAddBookmark}
                className="text-white hover:text-yellow-400"
                title="Add bookmark"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </button>

              {/* Notes */}
              <button
                onClick={() => setShowNotePanel(!showNotePanel)}
                className="text-white hover:text-blue-400"
                title="Notes"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>

              {/* Captions */}
              {captions.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setShowCaptionMenu(!showCaptionMenu)}
                    className={`text-white hover:text-green-400 ${activeCaption ? 'text-green-400' : ''}`}
                    title="Captions"
                  >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1z" />
                    </svg>
                  </button>
                  {showCaptionMenu && (
                    <div className="absolute bottom-8 right-0 bg-gray-900/95 rounded-lg shadow-lg py-2 min-w-[150px] z-50">
                      <button
                        onClick={() => {
                          setActiveCaption(null);
                          setShowCaptionMenu(false);
                          if (videoRef.current) {
                            const tracks = videoRef.current.textTracks;
                            for (let i = 0; i < tracks.length; i++) {
                              tracks[i].mode = 'disabled';
                            }
                          }
                        }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-white/10 ${
                          !activeCaption ? 'text-green-400' : 'text-white'
                        }`}
                      >
                        Off
                      </button>
                      {captions.map((caption) => (
                        <button
                          key={caption.id}
                          onClick={() => {
                            setActiveCaption(caption.language_code);
                            setShowCaptionMenu(false);
                            if (videoRef.current) {
                              const tracks = videoRef.current.textTracks;
                              for (let i = 0; i < tracks.length; i++) {
                                tracks[i].mode = tracks[i].language === caption.language_code ? 'showing' : 'disabled';
                              }
                            }
                          }}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-white/10 ${
                            activeCaption === caption.language_code ? 'text-green-400' : 'text-white'
                          }`}
                        >
                          {caption.label || caption.language_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Fullscreen */}
              <button onClick={toggleFullscreen} className="text-white hover:text-purple-400">
                {isFullscreen ? (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bookmarks Panel */}
      {showBookmarkPanel && (
        <div className="absolute top-4 right-4 w-64 bg-white rounded-lg shadow-lg p-4 max-h-64 overflow-y-auto">
          <h3 className="font-semibold mb-2">Bookmarks</h3>
          {bookmarks.length === 0 ? (
            <p className="text-gray-500 text-sm">No bookmarks yet</p>
          ) : (
            <ul className="space-y-2">
              {bookmarks.map((bookmark) => (
                <li key={bookmark.id} className="flex items-center justify-between text-sm">
                  <button
                    onClick={() => jumpToTimestamp(bookmark.timestamp)}
                    className="text-purple-600 hover:underline"
                  >
                    {formatTime(bookmark.timestamp)}
                  </button>
                  <button
                    onClick={() => handleDeleteBookmark(bookmark.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Notes Panel */}
      {showNotePanel && (
        <div className="absolute top-4 right-4 w-80 bg-white rounded-lg shadow-lg p-4 max-h-96 overflow-y-auto">
          <h3 className="font-semibold mb-2">Notes</h3>

          {/* Add Note */}
          <div className="mb-4">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a note at this timestamp..."
              className="w-full p-2 border rounded text-sm resize-none"
              rows={2}
            />
            <button
              onClick={handleAddNote}
              disabled={!newNote.trim()}
              className="mt-2 px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 disabled:opacity-50"
            >
              Add Note ({formatTime(currentTime)})
            </button>
          </div>

          {/* Notes List */}
          {notes.length === 0 ? (
            <p className="text-gray-500 text-sm">No notes yet</p>
          ) : (
            <ul className="space-y-3">
              {notes.map((note) => (
                <li key={note.id} className="border-b pb-2">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => jumpToTimestamp(note.timestamp)}
                      className="text-purple-600 text-xs hover:underline"
                    >
                      {formatTime(note.timestamp)}
                    </button>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="text-red-500 text-xs hover:text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                  <p className="text-sm mt-1">{note.content}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default VideoPlayer;
