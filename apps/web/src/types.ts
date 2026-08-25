export type { PostSummaryDTO, PostDetailDTO, CategoryDTO, TagDTO, UserDTO, RegistrationMode, PostVisibility } from '@qujt/shared';

export interface SiteInfo {
  siteName: string;
  siteDescription: string;
  icp: string;
  registrationMode: 'closed' | 'invite' | 'open';
  commentModeration: boolean;
  categories: import('@qujt/shared').CategoryDTO[];
}

export interface PostListResult {
  items: import('@qujt/shared').PostSummaryDTO[];
  total: number;
  page: number;
  pageSize: number;
}
