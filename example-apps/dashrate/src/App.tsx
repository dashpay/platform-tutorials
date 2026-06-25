import { useCallback, useMemo, useState } from "react";
import { findResource, RESOURCES } from "./catalog/resources";
import { AppNotices } from "./components/AppNotices";
import { HowItWorks } from "./components/HowItWorks";
import { MyReviewsView } from "./components/MyReviewsView";
import { ResourcesView } from "./components/ResourcesView";
import { SettingsView } from "./components/SettingsView";
import { TopNav, type View } from "./components/TopNav";
import {
  clearStoredContractId,
  loadStoredContractId,
  registerContract,
  saveContractId,
} from "./dash/contract";
import { fetchReviewHistory, type ReviewHistoryEntry } from "./dash/history";
import type { ReviewRecord } from "./dash/queries";
import { saveReview } from "./dash/review";
import { loadSdkCore } from "./dash/sdkCore";
import type { DashKeyManager, DashSdk } from "./dash/types";
import { useDpnsNames } from "./hooks/useDpnsNames";
import { useMyReviews } from "./hooks/useMyReviews";
import { useResourceRatings } from "./hooks/useResourceRatings";
import { consoleLogger, errorMessage, type LogLevel } from "./lib/logger";
import type { Session } from "./session/types";

export default function App() {
  const [contractId, setContractId] = useState(loadStoredContractId);
  const [contractInput, setContractInput] = useState(contractId);
  const [session, setSession] = useState<Session | null>(null);
  const [selectedResourceId, setSelectedResourceId] = useState(RESOURCES[0].id);
  const [view, setView] = useState<View>("resources");
  const [mnemonic, setMnemonic] = useState("");
  const [identityIndex, setIdentityIndex] = useState("0");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [history, setHistory] = useState<ReviewHistoryEntry[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedResource = useMemo(
    () => findResource(selectedResourceId) ?? RESOURCES[0],
    [selectedResourceId],
  );

  const log = useCallback((message: string, level: LogLevel = "info") => {
    consoleLogger(message, level);
    if (level !== "info") setStatus(message);
  }, []);

  const connectReadOnly = useCallback(async (): Promise<DashSdk> => {
    const { createClient } = await loadSdkCore();
    return (await createClient("testnet")) as unknown as DashSdk;
  }, []);

  const ratings = useResourceRatings({
    contractId,
    session,
    selectedResourceId,
    connectReadOnly,
    log,
    setStatus,
  });

  const myReviewsState = useMyReviews({
    contractId,
    enabled: view === "my-reviews",
    session,
    log,
  });

  const dpnsNames = useDpnsNames({
    reviews: ratings.reviews,
    myReviews: myReviewsState.myReviews,
    session,
    connectReadOnly,
  });

  async function handleSignIn(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus("Connecting...");
    try {
      const { createClient, IdentityKeyManager } = await loadSdkCore();
      const sdk = (await createClient("testnet")) as unknown as DashSdk;
      const keyManager = (await IdentityKeyManager.create({
        sdk: sdk as never,
        mnemonic: mnemonic.trim(),
        network: "testnet",
        identityIndex: Number(identityIndex) || 0,
      })) as unknown as DashKeyManager;
      const identityId = String(keyManager.identityId ?? "");
      if (!identityId) throw new Error("No identity found for this mnemonic.");
      setSession({ sdk, keyManager, identityId });
      setMnemonic("");
      setStatus("");
    } catch (err) {
      setStatus(`Sign-in failed: ${errorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveReview(event: React.FormEvent) {
    event.preventDefault();
    if (!session) {
      setStatus("Sign in before saving a review.");
      return;
    }
    if (!contractId) {
      setStatus("Register or paste a DashRate contract ID first.");
      return;
    }
    if (ratings.rating === null) {
      setStatus("Choose a star rating before saving your review.");
      return;
    }

    setBusy(true);
    setStatus("");
    try {
      await saveReview({
        sdk: session.sdk,
        keyManager: session.keyManager,
        contractId,
        resourceId: selectedResource.id,
        rating: ratings.rating,
        reviewText: ratings.reviewText,
        log,
      });
      await ratings.loadResourceData(session.sdk);
      await myReviewsState.refreshMyReviews(session);
      await ratings.refreshReviews(session.sdk);
      setStatus("");
    } catch (err) {
      setStatus(`Save failed: ${errorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleRegisterContract() {
    if (!session) {
      setStatus("Sign in before registering a contract.");
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      const id = await registerContract({
        sdk: session.sdk,
        keyManager: session.keyManager,
        log,
      });
      setContractId(id);
      setContractInput(id);
      setStatus(`Registered new contract: ${id}`);
    } catch (err) {
      setStatus(`Registration failed: ${errorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleLoadHistory(reviewId: string) {
    if (!session || !contractId) return;
    setBusy(true);
    setStatus("Loading review history...");
    try {
      const entries = await fetchReviewHistory({
        sdk: session.sdk,
        contractId,
        reviewId,
      });
      setHistory(entries);
      setStatus("");
    } catch (err) {
      setStatus(`History failed: ${errorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  }

  function handleContractSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextId = contractInput.trim();
    if (!nextId) return;
    saveContractId(nextId);
    setContractId(nextId);
    setContractInput(nextId);
    myReviewsState.setMyReviews([]);
  }

  function clearContract() {
    clearStoredContractId();
    setContractId("");
    setContractInput("");
    setHistory([]);
    myReviewsState.setMyReviews([]);
    ratings.setMySelectedReview(null);
  }

  function signOut() {
    setSession(null);
    myReviewsState.setMyReviews([]);
    ratings.setMySelectedReview(null);
    setHistory([]);
  }

  function handleSelectResource(resourceId: string) {
    setSelectedResourceId(resourceId);
    ratings.setReviewFilter(null);
    setHistory([]);
  }

  function handleEditMyReview(review: ReviewRecord) {
    setSelectedResourceId(review.resourceId);
    ratings.setReviewFilter(null);
    ratings.setMySelectedReview(review);
    ratings.setRating(review.rating);
    ratings.setHoverRating(null);
    ratings.setReviewText(review.reviewText);
    setHistory([]);
    setView("resources");
  }

  return (
    <main className="shell">
      <TopNav view={view} onViewChange={setView} />

      <AppNotices status={status} hasContract={Boolean(contractId)} />

      {view === "resources" && (
        <ResourcesView
          selectedResource={selectedResource}
          summaries={ratings.summaries}
          distributions={ratings.distributions}
          reviews={ratings.reviews}
          reviewFilter={ratings.reviewFilter}
          loadingRatings={ratings.loadingRatings}
          history={history}
          signedIn={Boolean(session)}
          busy={busy}
          contractId={contractId}
          rating={ratings.rating}
          hoverRating={ratings.hoverRating}
          reviewText={ratings.reviewText}
          hasSelectedReview={Boolean(ratings.mySelectedReview)}
          dpnsNames={dpnsNames}
          onSelectResource={handleSelectResource}
          onReviewFilterChange={ratings.setReviewFilter}
          onSaveReview={handleSaveReview}
          onOpenSettings={() => setView("settings")}
          onRatingChange={ratings.setRating}
          onHoverRatingChange={ratings.setHoverRating}
          onReviewTextChange={ratings.setReviewText}
          onLoadHistory={() => {
            if (history.length > 0) {
              setHistory([]);
              return;
            }
            if (ratings.mySelectedReview) {
              void handleLoadHistory(ratings.mySelectedReview.id);
            }
          }}
        />
      )}

      {view === "my-reviews" && (
        <MyReviewsView
          session={session}
          dpnsNames={dpnsNames}
          myReviews={myReviewsState.myReviews}
          myReviewsLoading={myReviewsState.myReviewsLoading}
          myReviewsAverage={myReviewsState.myReviewsAverage}
          onEdit={handleEditMyReview}
        />
      )}

      {view === "settings" && (
        <SettingsView
          session={session}
          dpnsNames={dpnsNames}
          busy={busy}
          mnemonic={mnemonic}
          identityIndex={identityIndex}
          showAdvanced={showAdvanced}
          contractId={contractId}
          contractInput={contractInput}
          onMnemonicChange={setMnemonic}
          onIdentityIndexChange={setIdentityIndex}
          onShowAdvancedChange={setShowAdvanced}
          onContractInputChange={setContractInput}
          onSignIn={handleSignIn}
          onSignOut={signOut}
          onContractSubmit={handleContractSubmit}
          onClearContract={clearContract}
          onRegisterContract={handleRegisterContract}
        />
      )}

      {view === "how" && <HowItWorks />}
    </main>
  );
}
