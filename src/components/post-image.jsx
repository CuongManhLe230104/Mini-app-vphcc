import { useEffect, useState } from "react";
import { resolvePostImageUrl } from "../services/api";

export default function PostImage({ src, alt = "", className = "" }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const url = resolvePostImageUrl(src);
  if (!url || failed) return null;
  return <img src={url} alt={alt} className={className} loading="lazy" decoding="async"
    onError={() => setFailed(true)} />;
}
