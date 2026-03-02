import { BrowserRouter, Routes, Route } from "react-router-dom";
import NavBar from "./components/NavBar";
import LandingPage from "./pages/LandingPage";
import StudyPage from "./pages/StudyPage";
import LibraryPage from "./pages/LibraryPage";
import SubjectDetailPage from "./pages/SubjectDetailPage";
import BriefDetailPage from "./pages/BriefDetailPage";

export default function App() {
  return (
    <BrowserRouter>
      <div>
        <NavBar />
        <main className="pt-14">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/library/briefs/:id" element={<BriefDetailPage />} />
            <Route path="/library/:slug" element={<SubjectDetailPage />} />
            <Route path="/study" element={<StudyPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
