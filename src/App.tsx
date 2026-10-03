import { useEffect, useMemo, useRef, useState } from "react";
import { GlobeMap } from "./components/GlobeMap";
import type { Photo, PhotoLocation } from "./data/types";
import { importPhotosFromFiles } from "./lib/importPhotos";
import { loadImported, saveImported, renameLocation, removePhoto } from "./lib/store";
import { supabase } from "./lib/supabase";
import { signUp, signIn, signOut, loadCloudLocations, uploadLocations, deleteCloudPhoto, renameCloudLocation } from "./lib/cloudSync";

type ImportStatus = { kind: "working" | "done" | "error"; text: string } | null;
type AuthState = "loading" | "signedOut" | "signedIn";

function App() {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [userEmail, setUserEmail] = useState("");
  const [showAuthPanel, setShowAuthPanel] = useState(false);
  const [authMode, setAuthMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  const [activeLocationId, setActiveLocationId] = useState<string>();
  const [clusterMembers, setClusterMembers] = useState<PhotoLocation[] | null>(null);
  const [coverOverrides, setCoverOverrides] = useState<Record<string, string>>({});
  const [activePhoto, setActivePhoto] = useState<Photo>();
  const [showGallery, setShowGallery] = useState(false);
  const [locations, setLocations] = useState<PhotoLocation[]>([]);
  const [importStatus, setImportStatus] = useState<ImportStatus>(null);
  const [loadingImported, setLoadingImported] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; photo: Photo } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setAuthState("signedIn");
        setUserEmail(data.session.user.email ?? "");
      } else {
        setAuthState("signedOut");
        setShowAuthPanel(true);
      }
    });
  }, []);

  useEffect(() => {
    if (authState === "signedIn") {
      setLoadingImported(true);
      setLoadError(false);
      loadCloudLocations()
        .then((locs) => setLocations(locs))
        .catch(() => setLoadError(true))
        .finally(() => setLoadingImported(false));
    } else if (authState === "signedOut") {
      let cancelled = false;
      setLoadingImported(true);
      setLoadError(false);
      setLoadedCount(0);
      loadImported((batch) => {
        if (!cancelled) {
          setLocations((current) => [...current, ...batch]);
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
    }
  }, [authState]);

  const activeLocation = useMemo(
    () => locations.find((location) => location.id === activeLocationId),
    [locations, activeLocationId]
  );

  const allPhotos = useMemo(
    () =>
      locations.flatMap((location) =>
        location.photos.map((photo) => ({
          photo,
          locationName: location.name,
          country: location.country
        }))
      ),
    [locations]
  );

  const coverId = activeLocation
    ? coverOverrides[activeLocation.id] || activeLocation.coverPhotoId
    : undefined;

  const handleAuth = async () => {
    if (!email.trim() || password.length < 6) {
      setAuthError("请输入邮箱，密码至少 6 位");
      return;
    }
    setAuthBusy(true);
    setAuthError("");
    const fn = authMode === "signIn" ? signIn : signUp;
    const err = await fn(email.trim(), password);
    if (err) {
      setAuthError(err);
      setAuthBusy(false);
      return;
    }
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      setAuthState("signedIn");
      setUserEmail(data.session.user.email ?? "");
      setShowAuthPanel(false);
    } else {
      setAuthError("注册成功，请检查邮箱确认后登录");
    }
    setAuthBusy(false);
  };

  const handleSignOut = async () => {
    await signOut();
    setLocations([]);
    setActiveLocationId(undefined);
    setActivePhoto(undefined);
    setCoverOverrides({});
    setAuthState("signedOut");
    setShowAuthPanel(true);
  };

  const handleSelect = (location: PhotoLocation) => {
    setClusterMembers(null);
    setActiveLocationId(location.id);
  };

  const handleSetCover = (locationId: string, photoId: string) =>
    setCoverOverrides((current) => ({ ...current, [locationId]: photoId }));

  const handleRename = (locationId: string, name: string) => {
    setLocations((current) =>
      current.map((loc) => (loc.id === locationId ? { ...loc, name } : loc))
    );
    if (authState === "signedIn") {
      renameCloudLocation(locationId, name).catch(() => {});
    } else {
      renameLocation(locationId, name).catch(() => {});
    }
  };

  const commitRename = (rawName: string) => {
    setEditingName(false);
    const name = rawName.trim();
    if (!name || !activeLocation || name === activeLocation.name) return;
    handleRename(activeLocation.id, name);
  };

  const handleDeletePhoto = (photoId: string) => {
    setLocations((current) =>
      current
        .map((loc) => {
          if (!loc.photos.some((p) => p.id === photoId)) return loc;
          const photos = loc.photos.filter((p) => p.id !== photoId);
          if (photos.length === 0) return null;
          return {
            ...loc,
            photos,
            coverPhotoId: loc.coverPhotoId === photoId ? photos[0].id : loc.coverPhotoId
          };
        })
        .filter((loc): loc is PhotoLocation => loc !== null)
    );
    if (authState === "signedIn") {
      deleteCloudPhoto(photoId).catch(() => {});
    } else {
      removePhoto(photoId).catch(() => {});
    }
    if (activePhoto?.id === photoId) setActivePhoto(undefined);
    if (activeLocation && activeLocation.photos.some((p) => p.id === photoId)) {
      const remaining = activeLocation.photos.filter((p) => p.id !== photoId);
      if (remaining.length === 0) setActiveLocationId(undefined);
    }
  };

  const handleImportClick = () => {
    setMenuOpen(false);
    fileInputRef.current?.click();
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setImportStatus({ kind: "working", text: "正在读取 " + files.length + " 张照片的定位…" });
    try {
      const result = await importPhotosFromFiles(Array.from(files));
      if (result.totalPhotos > 0) {
        if (authState === "signedIn") {
          setImportStatus({ kind: "working", text: "正在上传照片到云端…" });
          await uploadLocations(result.stored);
          const locs = await loadCloudLocations();
          setLocations(locs);
        } else {
          setLocations((current) => [...current, ...result.locations]);
          saveImported(result.stored).catch(() => {});
        }
      }
      const parts: string[] = ["成功导入 " + result.totalPhotos + " 张"];
      if (result.skipped.length) parts.push(result.skipped.length + " 张没有定位信息");
      if (result.failed.length) parts.push(result.failed.length + " 张读取失败");
      setImportStatus({ kind: "done", text: parts.join("，") });
    } catch {
      setImportStatus({ kind: "error", text: "导入失败，请重试" });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (authState === "loading") {
    return (
      <main className="app-shell">
        <div className="stars" aria-hidden="true" />
        <div className="auth-loading">正在加载…</div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div className="stars" aria-hidden="true" />

      <GlobeMap
        locations={locations}
        covers={coverOverrides}
        activeLocationId={activeLocationId}
        onSelectLocation={handleSelect}
        onSelectCluster={(members) => {
          setActiveLocationId(undefined);
          setClusterMembers(members);
        }}
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
          <em>{authState === "signedIn" ? "云端已同步" : "照片只保存在本机"}</em>
        </header>

        <div className="quick-bar">
          <button
            className={"quick-toggle" + (menuOpen ? " is-open" : "")}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "收起" : "打开"}
          >
            {menuOpen ? "×" : "＋"}
          </button>
          {menuOpen && (
            <div className="quick-menu">
              <button className="action-item import" onClick={handleImportClick}>导入</button>
              <button className="action-item" onClick={() => { setShowGallery(true); setMenuOpen(false); }}>相册</button>
              {authState === "signedIn" ? (
                <button className="action-item" onClick={() => { setMenuOpen(false); handleSignOut(); }}>登出</button>
              ) : (
                <button className="action-item" onClick={() => { setMenuOpen(false); setShowAuthPanel(true); }}>登录</button>
              )}
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
        <div className={"import-toast " + importStatus.kind}>
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
        <div className="import-toast error">⚠️ 照片读取失败，请刷新页面重试</div>
      )}

      {!loadingImported && !loadError && locations.length === 0 && !showAuthPanel && (
        <div className="empty-state">
          <strong>还没有照片</strong>
          <span>点左上角“＋”→“导入”添加照片。</span>
        </div>
      )}

      {showAuthPanel && authState === "signedOut" && (
        <div className="auth-panel">
          <div className="auth-card">
            <div className="auth-head">
              <strong>印迹</strong>
              <span>登录后照片云端同步，换设备也能看</span>
            </div>
            <input
              className="auth-input"
              type="email"
              placeholder="邮箱（QQ邮箱即可）"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <input
              className="auth-input"
              type="password"
              placeholder="密码（至少 6 位）"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleAuth();
              }}
            />
            {authError && <p className="auth-error">{authError}</p>}
            <button className="auth-button" onClick={handleAuth} disabled={authBusy}>
              {authBusy ? "请稍候…" : authMode === "signIn" ? "登录" : "注册"}
            </button>
            <button
              className="auth-switch"
              onClick={() => {
                setAuthMode((m) => (m === "signIn" ? "signUp" : "signIn"));
                setAuthError("");
              }}
            >
              {authMode === "signIn" ? "没有账号？注册一个" : "已有账号？去登录"}
            </button>
            <button
              className="auth-skip"
              onClick={() => {
                setShowAuthPanel(false);
                setAuthError("");
              }}
            >
              暂不登录，本地使用
            </button>
          </div>
        </div>
      )}

      <div
        className={"gallery-panel " + (showGallery ? "is-open" : "")}
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
              {allPhotos.map(({ photo, locationName }, i) => (
                <div
                  className="gallery-photo cascade"
                  style={{ animationDelay: i * 35 + "ms" }}
                  key={photo.id}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setContextMenu({ x: event.clientX, y: event.clientY, photo });
                  }}
                >
                  <button className="gallery-photo-open" onClick={() => setActivePhoto(photo)}>
                    <img src={photo.thumb} alt={photo.title} loading="lazy" decoding="async" />
                    <span className="gallery-title">{photo.title}</span>
                    <span className="gallery-addr">{locationName}</span>
                  </button>
                </div>
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

      <aside className={"location-panel " + (activeLocation || clusterMembers ? "is-open" : "")}>
        {clusterMembers ? (
          <>
            <button className="panel-close" onClick={() => setClusterMembers(null)} aria-label="关闭">
              ×
            </button>
            <div className="panel-heading">
              <span>合并显示</span>
              <h1>{clusterMembers.length} 个地点</h1>
              <p>{clusterMembers.reduce((n, l) => n + l.photos.length, 0)} 张照片 · 放大后自动分开</p>
            </div>
            <div className="photo-list">
              {clusterMembers.flatMap((loc) => loc.photos.map((photo) => ({ photo, locName: loc.name }))).map(({ photo, locName }) => (
                <article className="photo-tile cascade" key={photo.id}>
                  <button className="photo-open" onClick={() => setActivePhoto(photo)}>
                    <img src={photo.thumb} alt={photo.title} loading="lazy" decoding="async" />
                    <span>
                      <strong>{photo.title}</strong>
                      <small>{locName}</small>
                    </span>
                  </button>
                </article>
              ))}
            </div>
          </>
        ) : activeLocation ? (
          <>
            <button className="panel-close" onClick={() => setActiveLocationId(undefined)} aria-label="关闭">
              ×
            </button>

            <div className="panel-heading">
              <span>{activeLocation.country}</span>
              {editingName ? (
                <input
                  className="name-input"
                  autoFocus
                  defaultValue={activeLocation.name}
                  onBlur={(event) => commitRename(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                    if (event.key === "Escape") setEditingName(false);
                  }}
                />
              ) : (
                <h1 onClick={() => setEditingName(true)} title="点击修改地点名">
                  {activeLocation.name}
                  <button className="rename-hint" aria-label="修改地点名">✎</button>
                </h1>
              )}
              <p>{activeLocation.photos.length} 张照片 · 点击星标可改封面 · 点击地点名可改名</p>
            </div>

            <div className="photo-list">
              {activeLocation.photos.map((photo, i) => {
                const isCover = coverId === photo.id;
                return (
                  <article className={"photo-tile cascade " + (isCover ? "is-cover" : "")} style={{ animationDelay: i * 35 + "ms" }} key={photo.id}>
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
                      aria-label={"将 " + photo.title + " 设为封面"}
                      title={isCover ? "当前封面" : "设为封面"}
                    >
                      {isCover ? "★" : "☆"}
                    </button>
                  </article>
                );
              })}
            </div>
          </>
        ) : null}
      </aside>

      <div
        className={"photo-viewer " + (activePhoto ? "is-open" : "")}
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

      {contextMenu && (
        <>
          <div
            className="context-overlay"
            onClick={() => setContextMenu(null)}
            onContextMenu={(event) => {
              event.preventDefault();
              setContextMenu(null);
            }}
          />
          <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
            <button
              className="context-item"
              onClick={() => {
                const { id, title } = contextMenu.photo;
                setContextMenu(null);
                if (window.confirm("确定删除「" + title + "」吗？")) handleDeletePhoto(id);
              }}
            >
              删除
            </button>
          </div>
        </>
      )}
    </main>
  );
}

export default App;