// Refreshes the "Latest writing" list in README.md from the site's RSS feed.
// Run by .github/workflows/latest-writing.yml; changes only the lines between
// the LATEST-WRITING markers, and writes nothing when the list is unchanged.
import fs from "node:fs";

const FEED = "https://tiagoperes.com/feed.xml";
const COUNT = 5;
const START = "<!-- LATEST-WRITING:START -->";
const END = "<!-- LATEST-WRITING:END -->";
// Fixed names, so the date reads the same on any runner (Node's en-GB says "Sept").
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const decode = (s) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();

// A browser's request headers: Bot Fight Mode on tiagoperes.com answers 403 to a
// bare "node" client coming from a data centre such as GitHub's runners.
const res = await fetch(FEED, {
  headers: {
    "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
    accept: "application/rss+xml, application/xml;q=0.9, */*;q=0.8",
    "accept-language": "en",
  },
});
if (!res.ok) throw new Error(`${FEED} answered ${res.status}`);
const xml = await res.text();

const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, COUNT).map(([, item]) => {
  const field = (name) => decode(item.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1] ?? "");
  const date = new Date(field("pubDate"));
  const day = `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  // Square brackets in a title would break the Markdown link.
  return `- [${field("title").replace(/[[\]]/g, "")}](${field("link")}) (${day})`;
});
if (!items.length) throw new Error("the feed has no items");

const readme = fs.readFileSync("README.md", "utf8");
const start = readme.indexOf(START);
const end = readme.indexOf(END);
if (start < 0 || end < start) throw new Error("README.md has no LATEST-WRITING markers");

const next = `${readme.slice(0, start + START.length)}\n${items.join("\n")}\n${readme.slice(end)}`;
if (next === readme) {
  console.log("Latest writing is already current.");
} else {
  fs.writeFileSync("README.md", next);
  console.log(`Latest writing updated:\n${items.join("\n")}`);
}
