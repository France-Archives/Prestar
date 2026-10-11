import type { ISODate, UUID } from "./api";
import type { TermStatus } from "./enums";

// academic_terms -> AcademicTerm (derived)
export interface AcademicTerm {
  id: UUID;
  name: string;
  startDate: ISODate;
  endDate: ISODate; // > startDate
  corDeadline: ISODate; // <= endDate
  status: TermStatus;
}

/** D10 POST /admin/academic-terms */
export interface CreateAcademicTermRequest {
  name: string;
  startDate: ISODate;
  endDate: ISODate;
  corDeadline: ISODate;
  status?: TermStatus;
}

/** D11 PATCH /admin/academic-terms/:id */
export type UpdateAcademicTermRequest = Partial<CreateAcademicTermRequest>;