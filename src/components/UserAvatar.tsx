import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "lucide-react";

interface Props {
  path?: string | null;
  name?: string | null;
  className?: string;
  size?: number;
}

const cache = new Map<string, { url: string; exp: number }>();

export function useAvatarUrl(path?: string | null): string | null {
  const [url, setUrl] = useState<string | null>(() => {
    if (!path) return null;
    const c = cache.get(path);
    return c && c.exp > Date.now() ? c.url : null;
  });

  useEffect(() => {
    let cancel = false;
    if (!path) {
      setUrl(null);
      return;
    }
    const c = cache.get(path);
    if (c && c.exp > Date.now()) {
      setUrl(c.url);
      return;
    }
    supabase.storage.from("avatars").createSignedUrl(path, 3600).then(({ data }) => {
      if (cancel) return;
      if (data?.signedUrl) {
        cache.set(path, { url: data.signedUrl, exp: Date.now() + 3500 * 1000 });
        setUrl(data.signedUrl);
      }
    });
    return () => {
      cancel = true;
    };
  }, [path]);

  return url;
}

export function UserAvatar({ path, name, className = "", size = 32 }: Props) {
  const url = useAvatarUrl(path);
  const initials = (name ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-2 text-xs font-medium text-muted-foreground ring-1 ring-border ${className}`}
      style={{ width: size, height: size }}
    >
      {url ? (
        <img src={url} alt={name ?? "avatar"} className="h-full w-full object-cover" />
      ) : initials ? (
        <span>{initials}</span>
      ) : (
        <User className="h-1/2 w-1/2" />
      )}
    </div>
  );
}
