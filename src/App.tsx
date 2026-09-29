import { useEffect, useMemo, useRef, useState } from "react";
import { GlobeMap } from "./components/GlobeMap";
import type { Photo, PhotoLocation } from "./data/types";
import { importPhotosFromFiles } from "./lib/importPhotos";
import { loadImported, saveImported } from "./lib/store";

type ImportStatus = { kind: "working" | "done" | "error"; text: string } | null;

function App() {
  const [activeLocationId, setActiveLocationId] = useState<string>();
  const [coverOverrides, setCoverOverrides] = useState<Record<string, string>>({});
  const [activePhoto, setActivePhoto] = useState<Photo>();
  const [showGallery, setShowGallery] = useState(false);
  const [importedLocations, setImportedLocations] = useState<PhotoLocation[]>([]);
  const [importStatus, setImportStatus] = useState<ImportStatus>(null);
  const [loadingImported, setLoadingImported] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingImported(true);
    setLoadError(false);

    loadImported((batch) => {
      if (!cancelled) {
        setImportedLocations((current) => [...current, ...batch]);
        setLoadedCount((count) => count + batch.reduce((sum, loc) => sum + loc.photos.length, 0));
      }
    })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoadingImported(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const locations = importedLocations;

  const activeLocation = useMemo(
    () => locations.find((location) => location.id === activeLocationId),
    [locations, activeLocationId]
  );

  const allPhotos = useMemo(() => locations.flatMap((location) => location.photos), [locations]);

  const coverId = activeLocation
    ? coverOverrides[activeLocation.id] || activeLocation.coverPhotoId
    : undefined;

  const handleSelect = (location: PhotoLocation) => setActiveLocationId(location.id);

  const handleSetCover = (locationId: string, photoId: string) =>
    setCoverOverrides((current) => ({ ...current, [locationId]: photoId }));

  const handleImportClick = () => {
    setMenuOpen(false);
    fileInputRef.current?.click();
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setImportStatus({ kind: "working", text: `正在读取 ${files.length} 张照片的定位…` });
    try {
      const result = await importPhotosFromFiles(Array.from(files));
      if (result.totalPhotos > 0) {
        setImportedLocations((current) => [...current, ...result.locations]);
        saveImported(result.stored).catch(() => {});
      }
      const parts: string[] = [`成功导入 ${result.totalPhotos} 张`];
      if (result.skipped.length) parts.push(`${result.skipped.length} 张没有定位信息`);
      if (result.failed.length) parts.push(`${result.failed.length} 张读取失败`);
      setImportStatus({ kind: "done", text: parts.join("，") });
    } catch {
      setImportStatus({ kind: "error", text: "导入失败，请重试" });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <main className="app-shell">
      <div className="stars" aria-hidden="true" />

      <GlobeMap
        locations={locations}
        covers={coverOverrides}
        activeLocationId={activeLocationId}
        onSelectLocation={handleSelect}
      />

      <div className="top-left">
        <header className="brand-bar">
          <div className="brand-mark" aria-hidden="true">
            <span />
          </div>
          <div>
            <strong>印迹</strong>
            <span>Yinji</span>
          </div>
          <p>把走过的路，印在地球上。</p>
          <em>照片只保存在本机</em>
        </header>

        <div className="quick-bar">
          <button
            className="quick-toggle"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "收起" : "打开"}
          >
            {menuOpen ? "×" : "＋"}
          </button>
          {menuOpen && (
            <div className="quick-menu">
              <button className="action-item import" onClick={handleImportClick}>导入</button>
              <button className="action-item" onClick={() => { setShowGallery(true); setMenuOpen(false); }}>相册</button>
            </div>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => handleFiles(event.target.files)}
      />

      {importStatus && (
        <div className={`import-toast ${importStatus.kind}`}>
          {importStatus.kind === "working" ? "⏳ " : importStatus.kind === "done" ? "✅ " : "⚠️ "}
          {importStatus.text}
        </div>
      )}

      {loadingImported && !importStatus && (
        <div className="import-toast working">
          ⏳ 正在载入照片{loadedCount > 0 ? "（已载入 " + loadedCount + " 张）" : "…"}
        </div>
      )}

      {loadError && !importStatus && (
        <div className="import-toast error">⚠️ 本机照片读取失败，请刷新页面重试</div>
      )}

      {!loadingImported && !loadError && locations.length === 0 && (
        <div className="empty-state">
          <strong>还没有照片</strong>
          <span>点左上角“＋”→“导入”添加照片。</span>
        </div>
      )}

      <div
        className={`gallery-panel ${showGallery ? "is-open" : ""}`}
        onClick={(event) => {
          if (event.currentTarget === event.target) setShowGallery(false);
        }}
      >
        {showGallery && (
          <div className="gallery-card">
            <div className="gallery-head">
              <div>
                <span>全部照片</span>
                <h2>{allPhotos.length} 张</h2>
              </div>
              <button className="gallery-close" onClick={() => setShowGallery(false)} aria-label="关闭相册">×</button>
            </div>
            <div className="gallery-grid">
              {allPhotos.map((photo) => (
                <button className="gallery-photo" key={photo.id} onClick={() => setActivePhoto(photo)}>
                  <img src={photo.thumb} alt={photo.title} loading="lazy" decoding="async" />
                  <span>{photo.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="map-hint">
        <span>拖动地球</span>
        <span>滚轮缩放</span>
        <span>点击照片堆</span>
      </div>

      <aside className={`location-panel ${activeLocation ? "is-open" : ""}`}>
        {activeLocation && (
          <>
            <button className="panel-close" onClick={() => setActiveLocationId(undefined)} aria-label="关闭">
              ×
            </button>

            <div className="panel-heading">
              <span>{activeLocation.country}</span>
              <h1>{activeLocation.name}</h1>
              <p>{activeLocation.photos.length} 张照片 · 点击星标可改封面</p>
            </div>

            <div className="photo-list">
              {activeLocation.photos.map((photo) => {
                const isCover = coverId === photo.id;
                return (
                  <article className={`photo-tile ${isCover ? "is-cover" : ""}`} key={photo.id}>
                    <button className="photo-open" onClick={() => setActivePhoto(photo)}>
                      <img src={photo.thumb} alt={photo.title} loading="lazy" decoding="async" />
                      <span>
                        <strong>{photo.title}</strong>
                        <small>{photo.date}</small>
                      </span>
                    </button>
                    <button
                      className="cover-button"
                      onClick={() => handleSetCover(activeLocation.id, photo.id)}
                      aria-label={`将 ${photo.title} 设为封面`}
                      title={isCover ? "当前封面" : "设为封面"}
                    >
                      {isCover ? "★" : "☆"}
                    </button>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </aside>

      <div
        className={`photo-viewer ${activePhoto ? "is-open" : ""}`}
        onClick={(event) => {
          if (event.currentTarget === event.target) setActivePhoto(undefined);
        }}
      >
        {activePhoto && (
          <div className="viewer-card">
            <button className="viewer-close" onClick={() => setActivePhoto(undefined)} aria-label="关闭">
              ×
            </button>
            <img src={activePhoto.image} alt={activePhoto.title} />
            <div>
              <h2>{activePhoto.title}</h2>
              <p>{activePhoto.date}</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default App;