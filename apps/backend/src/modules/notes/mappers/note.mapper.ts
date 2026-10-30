import { NoteResponseDto } from '../dto/note-response.dto';
import { Note } from '../entities/note.entity';

export class NoteMapper {
  static toResponse(note: Note): NoteResponseDto {
    return {
      id: note.id,
      workspaceId: note.workspaceId,
      creatorId: note.creatorId,
      title: note.title,
      content: note.content,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    };
  }
}