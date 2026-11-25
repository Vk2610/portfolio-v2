import { useCursor } from './useCursor'
import './custom-cursor.css'

export function CustomCursor() {
  const { rootRef, shapeRef, spotlightLayerRef, supported } = useCursor()

  if (!supported) {
    return null
  }

  return (
    <>
      <div
        className="custom-cursor-overlay"
        aria-hidden="true"
        data-custom-cursor-overlay=""
      >
        <div
          ref={rootRef}
          className="custom-cursor-root"
          data-visible="false"
          data-variant="default"
          data-pressed="false"
        >
          <div
            ref={shapeRef}
            className="custom-cursor-shape"
            data-variant="default"
          />
        </div>
      </div>
      <div
        ref={spotlightLayerRef}
        className="custom-cursor-spotlight-layer"
        aria-hidden="true"
        data-custom-cursor-spotlight=""
      />
    </>
  )
}
