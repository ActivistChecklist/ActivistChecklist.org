import React from 'react';
import { cn } from "@/lib/utils";
import { RichText } from "@/components/RichText";

/**
 * VideoEmbed — dual-mode component.
 *
 * Storyblok mode: <VideoEmbed video_file={{ cached_url }} caption={richTextDoc} />
 * MDX mode:       <VideoEmbed src="/path/to/video.mp4">Caption text</VideoEmbed>
 */
export const VideoEmbed = ({
  video,
  video_file,
  src,        // MDX mode: plain string URL
  caption,    // Storyblok mode: RichText document
  children,   // MDX mode: caption as React children
  className,
  controls = true,
  autoplay = false,
  loop = false,
  muted = false,
  ...props
}) => {
  // Resolve video URL: prefer src (MDX), then Storyblok asset object
  const videoUrl = src || video_file?.cached_url || video_file?.filename;

  if (!videoUrl) {
    console.warn('VideoEmbed: No video URL provided');
    return null;
  }

  const isMp4 = videoUrl.toLowerCase().includes('.mp4');
  if (!isMp4) {
    console.warn('VideoEmbed: Video URL does not appear to be an MP4 file:', videoUrl);
  }

  // Caption content: prefer React children (MDX), fall back to RichText doc (Storyblok)
  const captionContent = children
    ? children
    : caption
      ? <RichText document={caption} className="text-sm text-muted-foreground prose-sm max-w-none" noWrapper={true} />
      : null;

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
      {captionContent && (
        <div className="mt-2 text-center max-w-full muted-links">
          {captionContent}
        </div>
      )}
    </div>
  );
};

export default VideoEmbed;
