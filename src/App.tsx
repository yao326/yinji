import { useMemo, useState } from "react";
import { GlobeMap } from "./components/GlobeMap";
import { demoLocations, type Photo, type PhotoLocation } from "./data/demoPhotos";

function App() {
  const [activeLocationId, setActiveLocationId] = useState<string>();
  const [coverOverrides, setCoverOverrides] = useState<Record<string, string>>({});
  const [activePhoto, setActivePhoto] = useState<Photo>();
  const [showGallery, setShowGallery] = useState(false);

  const activeLocation = useMemo(
    () => demoLocations.find((location) => location.id === activeLocationId),
    [activeLocationId]
  );

  const allPhotos = useMemo(() => demoLocations.flatMap((location) => location.photos), []);

  const coverId = activeLocation
    ? coverOverrides[activeLocation.id] || activeLocation.coverPhotoId
    : undefined;

  const handleSelect = (location: PhotoLocation) => {
    setActiveLocationId(location.id);
  };

  const handleSetCover = (locationId: string, photoId: string) => {
    setCoverOverrides((current) => ({ ...current, [locationId]: photoId }));
  };

  return (
    <main className="app-shell">
      <GlobeMap
        locations={demoLocations}
        covers={coverOverrides}
        activeLocationId={activeLocationId}
        onSelectLocation={handleSelect}
      />

      <header className="brand-bar">
        <div className="brand-mark" aria-hidden="true">
          <span />
        </div>
        <div>
          <strong>印迹</strong>
          <span>Yinji</span>
        </div>
        <p>把走过的路，印在地球上。</p>
        <button className="gallery-toggle" onClick={() => setShowGallery(true)}>相册</button>
        <em>界面原型 · 示例照片</em>
      </header>

      <div className={`gallery-panel ${showGallery ? "is-open" : ""}`}>
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
                <img src={photo.image} alt={photo.title} />
                <span>{photo.title}</span>
              </button>
            ))}
          </div>
        </div>
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
                      <img src={photo.image} alt={photo.title} />
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