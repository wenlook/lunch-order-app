// ---------------------------------------------------------------
// Firestore-backed storage — same shape as the original
// window.storage API (get/set/delete/list), so App.jsx didn't
// need to change how it calls these functions.
//
// Every key/value pair is stored as one document in a single
// "app-data" collection, with the document ID equal to the key
// (e.g. "menu:current", "order:2026-09-03:o_abc123").
// ---------------------------------------------------------------

import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  startAt,
  endAt,
  documentId,
} from "firebase/firestore";
import { db } from "./firebase-config";

const COLLECTION = "app-data";

export async function storageGet(key) {
  try {
    const snap = await getDoc(doc(db, COLLECTION, key));
    return snap.exists() ? snap.data().value : null;
  } catch (e) {
    console.error("storageGet failed:", key, e);
    return null;
  }
}

export async function storageSet(key, value) {
  try {
    await setDoc(doc(db, COLLECTION, key), { value });
    return true;
  } catch (e) {
    console.error("storageSet failed:", key, e);
    return false;
  }
}

export async function storageDelete(key) {
  try {
    await deleteDoc(doc(db, COLLECTION, key));
    return true;
  } catch (e) {
    console.error("storageDelete failed:", key, e);
    return false;
  }
}

// Returns all document IDs (keys) starting with `prefix`,
// e.g. storageList("order:2026-09-03:") -> all of that day's orders.
export async function storageList(prefix) {
  try {
    const q = query(
      collection(db, COLLECTION),
      orderBy(documentId()),
      startAt(prefix),
      endAt(prefix + "\uf8ff")
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.id);
  } catch (e) {
    console.error("storageList failed:", prefix, e);
    return [];
  }
}
