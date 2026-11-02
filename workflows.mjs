// App-authored teaching examples. No teaching labels are sent to Zoom.
export const workflows = {
  "text_sufficient": {
    "category": "Contact center routing",
    "title": "Clear billing intent · unrelated image",
    "code": "ROUTE-305",
    "text": "I was charged twice for the same subscription this month. Please investigate the duplicate charge. I can sign in normally and have no technical issue.",
    "screen": [
      "ACCOUNT PORTAL",
      "Welcome to your account",
      "Navigation: Home · Profile · Help",
      "No billing details shown"
    ],
    "hint": "Text states a single billing issue; the generic account screen adds no billing evidence. Compare whether adding it changes the decision unnecessarily.",
    "labels": {
      "billing": "Billing team",
      "technical": "Technical support",
      "review": "Manual triage"
    },
    "instructions": "Choose the team for this customer request using only supplied evidence. Route duplicate charges or payment disputes to billing; access and sign-in failures to technical support. If multiple distinct issues are supported or intent is unclear, choose manual triage. Do not assume that a screenshot explains an unseen customer message.",
    "descriptions": [
      "Investigate a supported billing or payment issue.",
      "Investigate a supported technical or account access issue.",
      "Have a person clarify or separate ambiguous or multiple issues."
    ],
    "predicates": [
      [
        "multiple_issues",
        "Multiple issues",
        "Does the supplied evidence support more than one distinct customer issue?"
      ],
      [
        "intent_unclear",
        "Intent unclear",
        "Is the supplied evidence insufficient or contradictory for selecting one support team?"
      ]
    ]
  },
  "visual_sufficient": {
    "category": "Visual inspection and classification",
    "title": "Visible exterior damage · neutral note",
    "code": "VIS-306",
    "image": "damaged",
    "text": "Here is the parcel exterior. Please classify only the visible packaging condition. I have not described its condition in this note.",
    "hint": "The illustration shows exterior damage; the note supplies no condition evidence. Judge only visible packaging, not unseen contents.",
    "labels": {
      "intact": "No visible damage",
      "damaged": "Visible damage",
      "review": "Need visual evidence"
    },
    "instructions": "Classify only the visible exterior packaging in the supplied evidence. Choose visible damage when dents, tears, or crushed edges are supported; choose no visible damage when adequate exterior evidence shows none; choose need visual evidence when packaging condition is not established. A neutral note is not evidence of intact packaging. Do not infer contents condition or recommend refunds.",
    "descriptions": [
      "The supplied exterior evidence shows no visible damage.",
      "The supplied evidence supports visible exterior damage.",
      "Request evidence that establishes exterior packaging condition."
    ],
    "predicates": [
      [
        "exterior_damage",
        "Exterior damage",
        "Does the supplied evidence support visible dents, tears, or crushed packaging edges?"
      ],
      [
        "condition_established",
        "Condition established",
        "Is there enough supplied evidence to classify the visible exterior packaging condition?"
      ]
    ],
    "screen": []
  },
  "complementary": {
    "category": "Document and form processing",
    "title": "Request details split across sources",
    "code": "FORM-307",
    "text": "For request FORM-307, the requesting team is Customer Support. The attached item slip is part of this same request. Use both sources when available.",
    "screen": [
      "ITEM SLIP · FORM-307",
      "Item: USB headset",
      "Quantity: 2",
      "This slip records item and quantity only"
    ],
    "hint": "The text supplies the team; the slip supplies item and quantity. Compare whether combining these complementary sources provides all required information.",
    "labels": {
      "ready": "Ready for review",
      "incomplete": "Request missing details",
      "review": "Resolve inconsistency"
    },
    "instructions": "Check whether this equipment request supplies an item, an integer quantity from 1 through 10, and a requesting team. For this workflow, fields may be supplied across a customer note and an attached item slip; neither source must contain every field. Use only supplied evidence. Choose ready when all required fields are supported and consistent, request missing details when any field is absent, and resolve inconsistency when values conflict, a quantity is invalid, or request identifiers mismatch. This is completeness triage, not purchase authorization.",
    "descriptions": [
      "All required request details are supplied consistently; send for human review.",
      "Ask for required details not present in the supplied evidence.",
      "Ask a person to reconcile inconsistent identifiers or invalid or conflicting values."
    ],
    "predicates": [
      [
        "request_complete",
        "Request complete",
        "Does the supplied evidence collectively provide an item, integer quantity from 1 through 10, and requesting team?"
      ],
      [
        "details_conflict",
        "Details conflict",
        "Does the supplied evidence contain conflicting field values, mismatched request identifiers, or an invalid quantity?"
      ]
    ]
  }
};
export const learningLenses = {
  "conflict": "Conflicting evidence: does the combined input warrant clarification?",
  "limited": "Insufficient evidence: does the decision request more information?",
  "text_sufficient": "Text sufficient: does an unrelated image add any value?",
  "visual_sufficient": "Image sufficient: can visible condition be classified without a descriptive note?",
  "complementary": "Complementary evidence: do both sources together fill the information gap?"
};
export function workflowFor(scenario='conflict'){
 if(['conflict','limited'].includes(scenario))return null;
 if(!Object.hasOwn(workflows,scenario))throw new Error('Choose a valid scenario.');
 return workflows[scenario];
}
export function workflowQuestions(workflow){
 return [{name:'route',type:'choice',instructions:workflow.instructions,choices:Object.entries(workflow.labels).map(([value],i)=>({value,description:workflow.descriptions[i]}))},...workflow.predicates.map(([name,,instructions])=>({name,type:'predicate',instructions}))];
}
