import { BrowserRouter, Routes, Route } from "react-router-dom";
import NavBar from "./components/NavBar";
import BriefsPage from "./pages/BriefsPage";
import ArchivePage from "./pages/ArchivePage";
import StudyPage from "./pages/StudyPage";
import LibraryPage from "./pages/LibraryPage";

export default function App() {
  return (
    <BrowserRouter>
      <div>
        <NavBar />
        <main className="pt-14">
          <Routes>
            <Route path="/" element={<BriefsPage />} />
            <Route path="/archive" element={<ArchivePage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/study" element={<StudyPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
