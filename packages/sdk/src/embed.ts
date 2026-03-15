import type { Embed, EmbedField } from '@gratonite/types';

export class EmbedBuilder {
  private embed: Partial<Embed> = { type: 'rich' };

  setTitle(title: string): this {
    this.embed.title = title;
    return this;
  }

  setDescription(description: string): this {
    this.embed.description = description;
    return this;
  }

  setColor(color: string): this {
    this.embed.color = color;
    return this;
  }

  setUrl(url: string): this {
    this.embed.url = url;
    return this;
  }

  setThumbnail(url: string): this {
    this.embed.thumbnail = { url };
    return this;
  }

  setImage(url: string): this {
    this.embed.image = url;
    return this;
  }

  setFooter(text: string, iconUrl?: string): this {
    this.embed.footer = { text, iconUrl };
    return this;
  }

  setAuthor(name: string, iconUrl?: string, url?: string): this {
    this.embed.author = { name, iconUrl, url };
    return this;
  }

  addField(name: string, value: string, inline?: boolean): this {
    if (!this.embed.fields) this.embed.fields = [];
    this.embed.fields.push({ name, value, inline });
    return this;
  }

  build(): Embed {
    return this.embed as Embed;
  }
}
