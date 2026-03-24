// Sprint 3: IWWF heat generation logic
// This file will implement the full IWWF format table:
//   3-6 athletes:  QUALIFICATION(1) + FINAL(1)
//   7-10 athletes: QUALIFICATION(2) + LCQ(1) + FINAL(1)
//   11-18 athletes: QUALIFICATION(2-3) + LCQ(2) + SEMIFINAL(2) + FINAL(1)
//   19-36 athletes: QUALIFICATION(4-6) + LCQ(4) + QUARTERFINAL(4) + SEMIFINAL(2) + FINAL(1)
//
// Distribution: SNAKE for qualification, LADDER for semi/finals, STEPLADDER for LCQ
