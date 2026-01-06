import { validateSearchParams } from "runed/kit";

import { graphql } from "$houdini";

import type { AllFilesPageQueryVariables } from "./$houdini";
import { searchParamsSchema } from "./schema";

export const _houdini_load = graphql(`
	query AllFilesPageQuery(
		$firstAttachments: Int = 10
		$afterAttachment: String
		$filterAttachments: AttachmentsFilter = {}
		$firstContacts: Int = 10
		$afterContact: String
	) {
		viewer {
			...NavbarFragment
			id
			attachments(first: $firstAttachments, after: $afterAttachment, filter: $filterAttachments) {
				pageInfo {
					endCursor
					hasNextPage
				}
				edges {
					cursor
					node {
						...AttachmentListItem
						id
					}
				}
			}
			contacts(first: $firstContacts, after: $afterContact) {
				pageInfo {
					endCursor
					hasNextPage
				}
				edges {
					cursor
					node {
						id
						name
						address
						avatar
					}
				}
			}
		}
	}
`);

export const _AllFilesPageQueryVariables: AllFilesPageQueryVariables = async ({ url }) => {
	const {
		data: { attachmentType, contactAddress },
	} = validateSearchParams(url, searchParamsSchema);

	return {
		filterAttachments: {
			...(attachmentType ? { attachmentType } : {}),
			...(contactAddress ? { contactAddress } : {}),
		},
	};
};
