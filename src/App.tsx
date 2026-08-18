/**
 * Entry point. The deliverable for this step is the static chat-UI mock at
 * /chat.html (markup + inline CSS only, no app logic). We render it full-bleed
 * here so the built page shows the exact artifact; the file itself is fully
 * standalone and can be dropped into the Luca project root as-is.
 */
export default function App() {
  return (
    <iframe
      src="/chat.html"
      title="Luca AI — chat interface mock"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        border: 0,
        display: "block",
        background: "#0d0d0d",
      }}
    />
  );
}
