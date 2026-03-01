import { useParams } from "react-router-dom";
import BriefsSubjectPage from "./BriefsSubjectPage";
import LanguageSubjectPage from "./LanguageSubjectPage";

export default function SubjectDetailPage() {
  const { slug } = useParams<{ slug: string }>();

  if (slug === "briefs") {
    return <BriefsSubjectPage />;
  }

  return <LanguageSubjectPage language={slug!} />;
}
