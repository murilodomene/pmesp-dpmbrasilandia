<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep `/ipc` routes as compatibility redirects to the canonical public `/ipm` routes, because previously shared public links must remain valid.
- Use the shared browser PDF renderer for non-Portaria document and full-process exports: fixed A4 width, line-safe page captures and compressed JPEG avoid responsive distortion, truncated lines and oversized files; keep the approved standalone Portaria renderer separate.
