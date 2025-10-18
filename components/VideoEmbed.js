import React from 'react';
import { cn } from "@/lib/utils";
import { RichText } from "@/components/RichText";

/**
 * VideoEmbed component for embedding MP4 videos in rich text content
 */
export const VideoEmbed = ({ video, video_file, caption, className, controls = true, autoplay = false, loop = false, muted = false, ...props }) => {
  // Extract the video URL from Storyblok video_file structure
  const videoUrl = video_file?.cached_url || video_file?.filename;
  
  if (!videoUrl) {
    console.warn('VideoEmbed: No video URL provided');
    return null;
  }

  // Check if it's an MP4 file
  const isMp4 = videoUrl.toLowerCase().includes('.mp4');
  
  if (!isMp4) {
    console.warn('VideoEmbed: Video URL does not appear to be an MP4 file:', videoUrl);
  }

  return (
    <div className={cn("my-4 flex flex-col items-center", className)} {...props}>
      <video
        controls={controls}
        autoPlay={autoplay}
        loop={loop}
        muted={muted}
        className="max-w-full h-auto max-h-[70vh] rounded-lg shadow-sm"
        preload="metadata"
      >
        <source src={videoUrl} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      {caption && (
        <div className="mt-2 text-center max-w-full muted-links">
          <RichText 
            document={caption} 
            className="text-sm text-muted-foreground prose-sm max-w-none" 
            noWrapper={true}
          />
        </div>
      )}
    </div>
  );
};

export default VideoEmbed;
