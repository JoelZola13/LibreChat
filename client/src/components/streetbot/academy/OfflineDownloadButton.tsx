/**
 * Offline Download Button Component.
 * Allows users to download courses for offline access.
 */

import React, { useState, useEffect } from 'react';
import { useOfflineAcademy } from './api/useOfflineAcademy';
import { getOrCreateUserId } from './api/userId';

interface OfflineDownloadButtonProps {
  courseId: string;
  courseName?: string;
  className?: string;
}

export function OfflineDownloadButton({
  courseId,
  courseName,
  className = '',
}: OfflineDownloadButtonProps) {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    setUserId(getOrCreateUserId());
  }, []);

  const {
    isOnline,
    downloadCourse,
    removeCourse,
    isDownloading,
    downloadProgress,
    isCourseOffline,
    pendingSyncCount,
    syncNow,
    storageUsage,
  } = useOfflineAcademy(userId || '');

  const [isOffline, setIsOffline] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const checkOffline = async () => {
      if (courseId) {
        const offline = await isCourseOffline(courseId);
        setIsOffline(offline);
      }
    };
    checkOffline();
  }, [courseId, isCourseOffline]);

  const handleDownload = async () => {
    try {
      await downloadCourse(courseId);
      setIsOffline(true);
    } catch (error) {
      console.error('Download failed:', error);
      alert('Failed to download course for offline access');
    }
  };

  const handleRemove = async () => {
    try {
      await removeCourse(courseId);
      setIsOffline(false);
    } catch (error) {
      console.error('Remove failed:', error);
    }
  };

  const handleSync = async () => {
    const result = await syncNow();
    alert(`Synced ${result.synced} items${result.failed > 0 ? `, ${result.failed} failed` : ''}`);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!userId) return null;

  return (
    <div className={`relative ${className}`}>
      {/* Main Button */}
      {isDownloading ? (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-100 rounded-lg">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-blue-700">Downloading... {downloadProgress}%</span>
          <div className="w-24 h-2 bg-blue-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${downloadProgress}%` }}
            />
          </div>
        </div>
      ) : isOffline ? (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Available Offline</span>
          </button>
          {showDetails && (
            <button
              onClick={handleRemove}
              className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Remove offline copy"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={handleDownload}
          disabled={!isOnline}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            isOnline
              ? 'bg-purple-600 text-white hover:bg-purple-700'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }`}
          title={isOnline ? 'Download for offline access' : 'Go online to download'}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span>Download</span>
        </button>
      )}

      {/* Network Status & Sync */}
      {showDetails && (
        <div className="absolute top-full left-0 mt-2 p-4 bg-white border rounded-lg shadow-lg z-10 min-w-64">
          {/* Network Status */}
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-600">
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>

          {/* Pending Sync */}
          {pendingSyncCount > 0 && (
            <div className="mb-3 p-2 bg-yellow-50 rounded">
              <div className="flex items-center justify-between">
                <span className="text-sm text-yellow-700">
                  {pendingSyncCount} pending {pendingSyncCount === 1 ? 'item' : 'items'}
                </span>
                {isOnline && (
                  <button
                    onClick={handleSync}
                    className="text-xs text-yellow-700 underline hover:text-yellow-800"
                  >
                    Sync now
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Storage Usage */}
          <div className="text-xs text-gray-500">
            <div className="flex justify-between mb-1">
              <span>Storage used:</span>
              <span>{formatBytes(storageUsage.usage)}</span>
            </div>
            <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500"
                style={{ width: `${Math.min(storageUsage.percent, 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OfflineDownloadButton;
