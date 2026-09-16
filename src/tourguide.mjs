/* Lazy loader for the locally vendored TourGuide JS build (assets/tourguide).
 * The dist exposes a `tourguide` global; it is only fetched when a setup tour
 * actually runs, so ordinary page loads carry no extra script.
 */

const SCRIPT_URL = "./assets/tourguide/tour.js";
const STYLE_URL = "./assets/tourguide/tour.min.css";

let loading = null;

export function loadTourGuide() {
  if (globalThis.tourguide?.TourGuideClient) return Promise.resolve(globalThis.tourguide.TourGuideClient);
  if (loading) return loading;

  loading = new Promise((resolve, reject) => {
    if (!document.querySelector("link[data-tourguide]")) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = STYLE_URL;
      link.dataset.tourguide = "";
      document.head.appendChild(link);
    }
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.dataset.tourguide = "";
    script.onload = () => {
      const Client = globalThis.tourguide?.TourGuideClient;
      if (Client) resolve(Client);
      else reject(new Error("TourGuide did not expose TourGuideClient"));
    };
    script.onerror = () => {
      loading = null;
      reject(new Error("TourGuide failed to load"));
    };
    document.head.appendChild(script);
  });

  return loading;
}
