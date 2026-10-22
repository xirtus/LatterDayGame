let campaign = null;
let pending = null;

export async function loadChapters() {
  if (campaign) return campaign.chapters;
  if (!pending) {
    pending = fetch(new URL('../content/chapters.json', import.meta.url))
      .then(response => {
        if (!response.ok) throw new Error(`Story could not be loaded (${response.status}).`);
        return response.json();
      })
      .then(data => {
        campaign = data;
        return data.chapters;
      })
      .catch(error => {
        pending = null;
        throw error;
      });
  }
  return pending;
}

export function getChapter(id) {
  return campaign?.chapters.find(chapter => chapter.id === String(id).padStart(2, '0')) ?? null;
}

export function getCampaign() {
  return campaign;
}

export function speakerName(id) {
  return campaign?.names[id] ?? id.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

export function sceneDialogue(id) {
  return getChapter(id)?.objectives.flatMap(objective => objective.lines) ?? [];
}
