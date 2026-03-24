import { useLocation } from "react-router-dom";
import NewsArticleDetail from "./NewsArticleDetail";
import NewsListing from "./NewsListing";

export default function NewsPage() {
  const location = useLocation();
  const pathSegments = location.pathname.replace(/^\/news\/?/, "").split("/").filter(Boolean);
  const articleSlug = pathSegments.length > 0 ? pathSegments[0] : null;

  if (articleSlug) {
    return <NewsArticleDetail slug={articleSlug} />;
  }

  return <NewsListing />;
}
