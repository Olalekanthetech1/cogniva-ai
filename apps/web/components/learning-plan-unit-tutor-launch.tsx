"use client";

import { useState } from "react";
import { TutorStartForm } from "@/components/tutor-start-form";

type Props = {
  revisionId: string;
  unitId: string;
  unitTitle: string;
  description: string | null;
  objectives: string[];
  concepts: string[];
};

export function LearningPlanUnitTutorLaunch({
  revisionId,
  unitId,
  unitTitle,
  description,
  objectives,
  concepts
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const promptParts = [
    "I am studying the unit \"" + unitTitle + "\" from my approved Cogniva learning plan.",
    description ? "Unit description: " + description : "",
    objectives.length ? "Learning objectives:\n- " + objectives.join("\n- ") : "",
    concepts.length ? "Concepts in this unit: " + concepts.join(", ") : "",
    "Guide me through this unit Socratically. Begin by checking what I understand, then teach and practice one meaningful step at a time. Do not simply provide a full lecture or skip ahead."
  ].filter(Boolean);
  const initialPrompt = promptParts.join("\n\n").slice(0, 4000);

  return (
    <div className="learning-plan-unit-tutor-launch">
      <button
        className="learning-plan-primary-button"
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        {isOpen ? "Close Tutor start" : "Start learning this unit"}
      </button>
      {isOpen && (
        <div className="learning-plan-unit-tutor-form">
          <p className="learning-plan-note">
            This session will be linked to this approved plan revision and unit.
            You can edit the starting prompt before beginning.
          </p>
          <TutorStartForm
            compact
            initialPrompt={initialPrompt}
            learningPlanRevisionId={revisionId}
            learningPlanUnitId={unitId}
          />
        </div>
      )}
    </div>
  );
}
