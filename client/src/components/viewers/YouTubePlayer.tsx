interface YouTubePlayerProps {
  videoUrl: string;
  className?: string;
}

function extractVideoId(url: string): string | null {
  // Handle various YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/, // Raw video ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function YouTubePlayer({ videoUrl, className = "" }: YouTubePlayerProps) {
  const videoId = extractVideoId(videoUrl);

  if (!videoId) {
    return (
      <div className="flex items-center justify-center h-64 bg-muted rounded-xl">
        <p className="text-muted-foreground">Invalid YouTube URL</p>
      </div>
    );
  }

  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&iv_load_policy=3&disablekb=0&fs=1&playsinline=1&showinfo=0&origin=${encodeURIComponent(window.location.origin)}`;

  return (
    <div className={`relative w-full aspect-video rounded-xl overflow-hidden shadow-lg ${className}`}>
      <iframe
        src={embedUrl}
        className="absolute inset-0 w-full h-full"
        title="YouTube Video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        referrerPolicy="no-referrer"
      />
      {/* Overlay to block top-left YouTube watermark/channel link */}
      <div
        className="absolute top-0 left-0 w-24 h-12 cursor-default z-10"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
      />
      {/* Overlay to block bottom-right YouTube logo click navigation */}
      <div
        className="absolute bottom-0 right-0 w-32 h-10 cursor-default z-10"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
      />
    </div>
  );
}
