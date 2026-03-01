import StatusHeader from "../components/StatusHeader";
import MissionSection from "../components/MissionSection";
import RecentGamesSection from "../components/RecentGamesSection";
import SubjectLevels from "../components/SubjectLevels";
import WeeklyRanking from "../components/WeeklyRanking";
import SectionError from "../components/SectionError";

export default function HomePage({ studentData, playedGameCount, missions, recentGames, subjectLevels, weeklyRanking, failedSections, onNavigateToRanking }) {
  return (
    <>
      <StatusHeader student={studentData} gameCount={playedGameCount} />
      {failedSections.includes('sessions') ? <SectionError message="ミッションデータを取得できませんでした" /> : <MissionSection missions={missions} />}
      {failedSections.includes('sessions') ? <SectionError message="プレイ履歴を取得できませんでした" /> : <RecentGamesSection recent={recentGames} />}
      {failedSections.includes('coins') ? <SectionError message="科目レベルを取得できませんでした" /> : <SubjectLevels subjects={subjectLevels} />}
      {failedSections.includes('rankings') ? <SectionError message="ランキングを取得できませんでした" /> : <WeeklyRanking ranking={weeklyRanking} onNavigateToRanking={onNavigateToRanking} />}
    </>
  );
}
