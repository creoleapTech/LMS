interface YouTubePlayerProps {
  videoUrl: string;
  className?: string;
}

function extractVideoId(url: string): string | null {
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

  // youtube-nocookie for privacy; rel=0 hides related videos at end;
  // modestbranding=1 minimizes YT logo; iv_load_policy=3 hides annotations
  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&iv_load_policy=3&fs=1&playsinline=1&controls=1`;

  return (
    <div className={`relative w-full aspect-video rounded-xl overflow-hidden shadow-lg ${className}`}>
      <iframe
        src={embedUrl}
        className="absolute inset-0 w-full h-full"
        title="YouTube Video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
}
