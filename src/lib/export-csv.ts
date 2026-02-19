import JSZip from "jszip";
import type { Vote, Question, QuestionResponse } from "@/types";

// --- Data shape interfaces matching ResponsesFilter props ---

interface Screenshot {
  id: string;
  sectionId: string | null;
  pageId: string | null;
  title: string | null;
  description: string | null;
  sourceType: "local" | "url";
  filePath: string | null;
  externalUrl: string | null;
}

interface ScreenshotWithVotes {
  screenshot: Screenshot;
  votes: Vote[];
  summary: { yes: number; mid: number; no: number; total: number };
}

interface SectionWithScreenshots {
  section: { name: string };
  screenshots: ScreenshotWithVotes[];
}

interface PageWithSections {
  page: { name: string };
  sections: SectionWithScreenshots[];
  pageScreenshots: ScreenshotWithVotes[];
}

export interface QuestionWithResponses {
  question: Question;
  responses: QuestionResponse[];
  scopeName: string;
}

// --- CSV helpers ---

function escapeCsvField(field: string | null | undefined): string {
  if (field == null) return "";
  const str = String(field);
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsvRow(fields: (string | null | undefined)[]): string {
  return fields.map(escapeCsvField).join(",");
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_ ]/g, "_").trim();
}

function getExtFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const ext = pathname.split(".").pop()?.toLowerCase();
    if (ext && ext.length <= 5) return `.${ext}`;
  } catch {
    // fall through
  }
  return ".png";
}

async function fetchFile(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// --- Votes ZIP export ---

export async function exportVotesZip(
  pages: PageWithSections[],
  projectName: string,
  onProgress?: (downloaded: number, total: number) => void
): Promise<void> {
  const zip = new JSZip();
  const imagesFolder = zip.folder("images")!;

  // Collect all unique screenshots and their URLs
  const screenshotFiles = new Map<string, { url: string; filename: string }>();
  let counter = 0;

  function getScreenshotUrl(s: Screenshot): string | null {
    return s.sourceType === "local" ? s.filePath : s.externalUrl;
  }

  for (const { page, sections, pageScreenshots } of pages) {
    for (const { screenshot } of pageScreenshots) {
      if (!screenshotFiles.has(screenshot.id)) {
        const url = getScreenshotUrl(screenshot);
        if (url) {
          counter++;
          const name = sanitize(screenshot.title || `screenshot_${counter}`);
          const ext = getExtFromUrl(url);
          screenshotFiles.set(screenshot.id, {
            url,
            filename: `${sanitize(page.name)}_${name}${ext}`,
          });
        }
      }
    }
    for (const { section, screenshots } of sections) {
      for (const { screenshot } of screenshots) {
        if (!screenshotFiles.has(screenshot.id)) {
          const url = getScreenshotUrl(screenshot);
          if (url) {
            counter++;
            const name = sanitize(screenshot.title || `screenshot_${counter}`);
            const ext = getExtFromUrl(url);
            screenshotFiles.set(screenshot.id, {
              url,
              filename: `${sanitize(page.name)}_${sanitize(section.name)}_${name}${ext}`,
            });
          }
        }
      }
    }
  }

  // Download all images in parallel
  const entries = Array.from(screenshotFiles.entries());
  let downloaded = 0;
  const total = entries.length;

  await Promise.all(
    entries.map(async ([id, { url, filename }]) => {
      const data = await fetchFile(url);
      if (data) {
        imagesFolder.file(filename, data);
      }
      downloaded++;
      onProgress?.(downloaded, total);
    })
  );

  // Build CSV with filenames
  const header = toCsvRow([
    "Page",
    "Section",
    "Screenshot Title",
    "Screenshot Description",
    "Image File",
    "Voter Email",
    "Vote",
    "Comment",
    "Date",
  ]);

  const rows: string[] = [header];

  function addScreenshotVotes(
    pageName: string,
    sectionName: string,
    sw: ScreenshotWithVotes
  ) {
    const { screenshot, votes } = sw;
    const fileInfo = screenshotFiles.get(screenshot.id);
    const imageFile = fileInfo ? `images/${fileInfo.filename}` : "";

    for (const vote of votes) {
      rows.push(
        toCsvRow([
          pageName,
          sectionName,
          screenshot.title,
          screenshot.description,
          imageFile,
          vote.voterIdentifier,
          vote.vote,
          vote.comment,
          vote.createdAt ? new Date(vote.createdAt).toLocaleString() : "",
        ])
      );
    }
  }

  for (const { page, sections, pageScreenshots } of pages) {
    for (const sw of pageScreenshots) {
      addScreenshotVotes(page.name, "", sw);
    }
    for (const { section, screenshots } of sections) {
      for (const sw of screenshots) {
        addScreenshotVotes(page.name, section.name, sw);
      }
    }
  }

  zip.file("votes.csv", "\uFEFF" + rows.join("\n"));

  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, `${sanitize(projectName)}_votes.zip`);
}

// --- Questionnaire ZIP export ---

interface FileToDownload {
  url: string;
  filename: string;
}

function parseFileInfo(
  question: Question,
  response: QuestionResponse,
  questionIndex: number,
  responseIndex: number
): { displayValue: string; files: FileToDownload[] } {
  if (question.fieldType === "checkbox" && response.value) {
    try {
      const items = JSON.parse(response.value);
      if (Array.isArray(items)) return { displayValue: items.join("; "), files: [] };
    } catch {
      // fall through
    }
  }

  if (question.fieldType === "file") {
    const files: FileToDownload[] = [];
    let displayNames: string[] = [];

    // Parse file paths (URLs)
    let urls: string[] = [];
    if (response.filePath) {
      try {
        const parsed = JSON.parse(response.filePath);
        if (Array.isArray(parsed)) urls = parsed;
      } catch {
        urls = [response.filePath];
      }
    }

    // Parse original file names
    let names: string[] = [];
    if (response.value) {
      try {
        const parsed = JSON.parse(response.value);
        if (Array.isArray(parsed)) names = parsed;
      } catch {
        names = [response.value];
      }
    }

    const prefix = `q${questionIndex + 1}_${sanitize(response.respondentEmail)}`;

    for (let i = 0; i < urls.length; i++) {
      const originalName = names[i] || `file_${i + 1}${getExtFromUrl(urls[i])}`;
      const safeFilename = `${prefix}_${sanitize(originalName)}`;
      // Ensure extension
      const hasExt = safeFilename.includes(".");
      const filename = hasExt ? safeFilename : safeFilename + getExtFromUrl(urls[i]);

      files.push({ url: urls[i], filename });
      displayNames.push(filename);
    }

    return { displayValue: displayNames.join("; "), files };
  }

  return { displayValue: response.value || "", files: [] };
}

export async function exportQuestionnaireZip(
  questionsWithResponses: QuestionWithResponses[],
  projectName: string,
  onProgress?: (downloaded: number, total: number) => void
): Promise<void> {
  const zip = new JSZip();
  const filesFolder = zip.folder("files")!;

  // First pass: collect all files to download and build CSV data
  const allFiles: FileToDownload[] = [];
  const csvData: {
    scopeName: string;
    label: string;
    fieldType: string;
    isRequired: boolean;
    email: string;
    displayValue: string;
    fileColumn: string;
    date: string;
  }[] = [];

  questionsWithResponses.forEach(({ question, responses, scopeName }, qIndex) => {
    for (const response of responses) {
      const { displayValue, files } = parseFileInfo(question, response, qIndex, 0);

      if (files.length > 0) {
        allFiles.push(...files);
      }

      csvData.push({
        scopeName,
        label: question.label,
        fieldType: question.fieldType,
        isRequired: question.isRequired,
        email: response.respondentEmail,
        displayValue,
        fileColumn: files.length > 0
          ? files.map((f) => `files/${f.filename}`).join("; ")
          : "",
        date: response.updatedAt
          ? new Date(response.updatedAt).toLocaleString()
          : "",
      });
    }
  });

  // Download all files in parallel
  let downloaded = 0;
  const total = allFiles.length;

  await Promise.all(
    allFiles.map(async ({ url, filename }) => {
      const data = await fetchFile(url);
      if (data) {
        filesFolder.file(filename, data);
      }
      downloaded++;
      onProgress?.(downloaded, total);
    })
  );

  // Build CSV
  const header = toCsvRow([
    "Scope",
    "Question Label",
    "Question Type",
    "Required",
    "Respondent Email",
    "Value",
    "File",
    "Date",
  ]);

  const rows: string[] = [header];

  for (const row of csvData) {
    rows.push(
      toCsvRow([
        row.scopeName,
        row.label,
        row.fieldType,
        row.isRequired ? "Yes" : "No",
        row.email,
        row.displayValue,
        row.fileColumn,
        row.date,
      ])
    );
  }

  zip.file("questionnaire.csv", "\uFEFF" + rows.join("\n"));

  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, `${sanitize(projectName)}_questionnaire.zip`);
}

