// Sprint 3: IWWF heat generation logic
// Input: division_id — generates stages and heats for a SINGLE division
// Reads CONFIRMED registrations from that division only
// Each division runs its own independent stage/heat pipeline
//
// This file will implement the full IWWF format table:
//   3-6 athletes:  QUALIFICATION(1) + FINAL(1)
//   7-10 athletes: QUALIFICATION(2) + LCQ(1) + FINAL(1)
//   11-18 athletes: QUALIFICATION(2-3) + LCQ(2) + SEMIFINAL(2) + FINAL(1)
//   19-36 athletes: QUALIFICATION(4-6) + LCQ(4) + QUARTERFINAL(4) + SEMIFINAL(2) + FINAL(1)
//
// Distribution: SNAKE for qualification, LADDER for semi/finals, STEPLADDER for LCQ
// Max 6 athletes per heat
//
// Creates: stage rows (with division_id + competition_id), heat rows, heat_athlete rows
// Sets published = false on all heats
