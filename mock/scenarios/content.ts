/** Synthetic inventions. Never a real disclosure. */
export const INVENTIONS = [
  { title: "Self-tensioning cable harness for articulated robot joints", area: "Robotics" },
  { title: "Low-latency torque estimation from motor back-EMF ripple", area: "Motion control" },
  { title: "Modular gripper fingers with swappable compliant pads", area: "End effectors" },
  { title: "Thermal drift compensation for optical encoders in warehouse robots", area: "Sensing" },
  { title: "Battery swap dock with passive alignment cones", area: "Logistics robots" },
  { title: "Collision-aware path smoothing using learned clearance maps", area: "Planning" },
  { title: "Electrostatic dust shield for lidar windows", area: "Sensing" },
  { title: "Reusable pallet wrap with embedded strain gauges", area: "Materials" },
  { title: "Graded-porosity ceramic filter for molten aluminium", area: "Metallurgy" },
  { title: "Recycled-fibre composite panel with fire-retardant core", area: "Composites" },
  { title: "Moisture-cured adhesive with delayed tack for panel assembly", area: "Adhesives" },
  { title: "Inline viscosity control for two-part resin dispensing", area: "Process control" },
] as const;

export const SECTIONS = ["background", "problem", "solution", "novelty", "application"] as const;
export const SECTION_TITLES: Record<(typeof SECTIONS)[number], string> = {
  background: "Background", problem: "Problem", solution: "Solution", novelty: "Novelty", application: "Application",
};

export const answersFor = (title: string, area: string, complete = true) => {
  const text = {
    background: `Teams working on ${area.toLowerCase()} rely on approaches that trade accuracy for cost. ${title} sits in that gap.`,
    problem: `Existing solutions either need manual recalibration or fail under sustained load, which costs time on every shift.`,
    solution: `The invention combines a passive mechanical element with a small control loop so the system corrects itself without operator input.`,
    novelty: complete ? `No known reference combines the passive element with closed-loop correction in this configuration; the closest work needs an external reference signal.` : "",
    application: `Applies to production lines, service robots and any setting where recalibration downtime matters.`,
  };
  const meta = SECTIONS.map((s) => ({ id: s, title: SECTION_TITLES[s], questions: [{ id: s, text: SECTION_TITLES[s], question: SECTION_TITLES[s], answer: text[s] }] }));
  const filled = SECTIONS.filter((s) => text[s].trim().length > 0).length;
  return { ...text, __meta_data: meta, __completion: Math.round((filled / SECTIONS.length) * 100) };
};

export const PRIOR_ART = [
  { publicationNumber: "US 2019/0143552 A1", title: "Cable management assembly for a robotic arm", abstract: "A cable management assembly comprising a spring-biased carriage that maintains tension on a cable bundle routed through a rotating joint.", url: null },
  { publicationNumber: "EP 3 421 776 B1", title: "Torque sensing arrangement for an electric actuator", abstract: "An arrangement in which motor phase current ripple is sampled to estimate output torque without a dedicated sensor.", url: null },
  { publicationNumber: "WO 2021/088114 A1", title: "Compliant finger pad for a gripper", abstract: "A gripper finger with a replaceable elastomer pad retained by a dovetail and a magnetic catch.", url: null },
  { publicationNumber: "US 10,972,101 B2", title: "Encoder temperature compensation", abstract: "A method for compensating optical encoder readings using a lookup table indexed by housing temperature.", url: null },
  { publicationNumber: "CN 112 345 678 A", title: "Porous ceramic filter for metal melts", abstract: "A ceramic foam filter with a uniform pore structure for filtering aluminium alloys.", url: null },
] as const;
