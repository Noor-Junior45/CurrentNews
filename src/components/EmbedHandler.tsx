import { Youtube, Facebook, Link2, Globe } from 'lucide-react';

interface EmbedHandlerProps {
  youtubeUrl?: string;
  facebookUrl?: string;
  customLinks?: string[];
  isHeader?: boolean;
}

/**
 * Extracts raw URLs from pasted <iframe> or data-href elements if the user pastes embed HTML code instead of a simple URL.
 */
function extractUrlFromEmbedCode(input: string = ''): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  // If it is an HTML block containing an iframe
  if (trimmed.includes('<iframe') && trimmed.includes('src=')) {
    const match = trimmed.match(/src=["']([^"']+)["']/);
    if (match && match[1]) {
      return match[1];
    }
  }

  // If it is a generic Facebook embed block containing data-href
  if (trimmed.includes('data-href=')) {
    const match = trimmed.match(/data-href=["']([^"']+)["']/);
    if (match && match[1]) {
      return match[1];
    }
  }

  return trimmed;
}

/**
 * Extracts the 11-character YouTube video ID from various YouTube URL formats or iframe codes.
 */
function getYouTubeVideoId(url: string = ''): string | null {
  const resolvedUrl = extractUrlFromEmbedCode(url);
  const trimmed = resolvedUrl.trim();
  if (!trimmed) return null;

  // Regular expression to extract the video ID or handles shorts and mobile links
  const pattern = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/;
  const match = trimmed.match(pattern);
  return match ? match[1] : null;
}

export default function EmbedHandler({ youtubeUrl, facebookUrl, customLinks, isHeader }: EmbedHandlerProps) {
  const hasYouTube = !!youtubeUrl && youtubeUrl.trim().length > 0;
  const hasFacebook = !!facebookUrl && facebookUrl.trim().length > 0;
  const validCustomLinks = (customLinks || []).filter(link => link && link.trim().length > 0);
  const hasCustom = validCustomLinks.length > 0;

  if (!hasYouTube && !hasFacebook && !hasCustom) return null;

  const ytVideoId = hasYouTube ? getYouTubeVideoId(youtubeUrl) : null;
  const resolvedFbUrl = hasFacebook ? extractUrlFromEmbedCode(facebookUrl) : '';
  const fbEncodedUrl = resolvedFbUrl ? encodeURIComponent(resolvedFbUrl.trim()) : null;

  return (
    <div className={isHeader ? "mb-8 pb-8 border-b border-slate-200" : "mt-12 pt-8 border-t border-slate-200"} id="embeds-section">
      <h3 className="font-display font-bold text-lg text-slate-900 mb-6 uppercase tracking-wider flex items-center space-x-2">
        <span>Media & Social References</span>
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* YouTube Video Embed */}
        {hasYouTube && (
          <div className="flex flex-col bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-2xs" id="yt-embed-box">
            <div className="flex items-center space-x-2 text-red-600 mb-3">
              <Youtube className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wider font-mono">YouTube Video Embed</span>
            </div>
            
            {ytVideoId ? (
              <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black shadow-inner">
                <iframe
                  src={`https://www.youtube.com/embed/${ytVideoId}`}
                  title="YouTube video player"
                  className="absolute top-0 left-0 w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 bg-red-50 text-red-700 rounded-lg text-center border border-red-200">
                <p className="text-sm font-medium">Unable to resolve video ID</p>
                <a href={youtubeUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline mt-1 truncate max-w-full">
                  {youtubeUrl}
                </a>
              </div>
            )}
          </div>
        )}

        {/* Facebook Embed */}
        {hasFacebook && (
          <div className="flex flex-col bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-2xs" id="fb-embed-box">
            <div className="flex items-center space-x-2 text-blue-600 mb-3">
              <Facebook className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wider font-mono">Facebook Reference</span>
            </div>

            {fbEncodedUrl ? (
              <div className={`w-full bg-white border border-slate-200 rounded-lg overflow-hidden p-1 flex justify-center shadow-inner ${facebookUrl.includes('/reel/') || facebookUrl.includes('/share/r/') ? 'min-h-[550px]' : 'min-h-[400px]'}`}>
                <iframe
                  src={
                    facebookUrl.includes('/reel/') || facebookUrl.includes('/share/r/') || facebookUrl.includes('/videos/') || facebookUrl.includes('watch')
                      ? `https://www.facebook.com/plugins/video.php?href=${fbEncodedUrl}&show_text=false&width=360`
                      : `https://www.facebook.com/plugins/post.php?href=${fbEncodedUrl}&show_text=true&width=500`
                  }
                  scrolling="no"
                  frameBorder="0"
                  allowFullScreen={true}
                  allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                  className={
                    facebookUrl.includes('/reel/') || facebookUrl.includes('/share/r/')
                      ? "w-full max-w-[360px] min-h-[550px] aspect-[9/16]"
                      : "w-full min-h-[400px] max-w-[500px]"
                  }
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 bg-blue-50 text-blue-700 rounded-lg text-center border border-blue-200">
                <p className="text-sm font-medium">Invalid Facebook Post URL</p>
                <a href={facebookUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline mt-1 truncate max-w-full">
                  {facebookUrl}
                </a>
              </div>
            )}
          </div>
        )}

        {/* Custom Integrations List */}
        {hasCustom && (
          <div className="col-span-1 md:col-span-2 flex flex-col bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-2xs" id="custom-embeds-box">
            <div className="flex items-center space-x-2 text-indigo-600 mb-4 pb-2 border-b border-slate-200/65">
              <Link2 className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wider font-mono">External Context & Social embeds ({validCustomLinks.length})</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {validCustomLinks.map((link, index) => {
                let domain = 'External Resource';
                try {
                  domain = new URL(link).hostname.replace('www.', '');
                } catch(e) {}

                return (
                  <a
                    key={index}
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 bg-white hover:bg-indigo-50/40 border border-slate-200 hover:border-indigo-300 rounded-xl transition-all duration-200 shadow-3xs group cursor-pointer"
                  >
                    <div className="h-8 w-8 rounded-lg bg-indigo-50 group-hover:bg-indigo-100/85 text-indigo-600 flex items-center justify-center shrink-0 transition-colors">
                      <Globe className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold text-slate-800 group-hover:text-indigo-600 truncate">
                        {domain}
                      </span>
                      <span className="block text-[10px] text-slate-400 font-mono truncate" title={link}>
                        {link}
                      </span>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
