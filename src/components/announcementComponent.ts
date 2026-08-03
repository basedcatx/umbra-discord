import { ContainerBuilder, heading, HeadingLevel, MediaGalleryBuilder, SeparatorSpacingSize } from 'discord.js';
import { ASSETS } from '../utils/asset_utils';

export function announcementComponent({
  title,
  messages,
  imageUrl = ASSETS.ANNOUNCEMENT_URL,
}: {
  title?: string;
  messages?: string[];
  imageUrl?: string;
}) {
  const container = new ContainerBuilder().addMediaGalleryComponents(
    new MediaGalleryBuilder().addItems((i) => i.setURL(imageUrl)),
  );

  if (title) {
    container
      .addTextDisplayComponents((td) => td.setContent(heading(title, HeadingLevel.Two)))
      .addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Large).setDivider(false));
  }

  if (messages && messages.length > 0) {
    messages.forEach((msg) =>
      container
        .addTextDisplayComponents((td) => td.setContent(msg))
        .addSeparatorComponents((s) => s.setDivider(false).setSpacing(SeparatorSpacingSize.Small)),
    );
  }

  return container;
}
