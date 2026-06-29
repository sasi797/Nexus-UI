import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface AIChatState {
  isOpen: boolean;
  messages: ChatMessage[];
  isLoading: boolean;
}

const initialState: AIChatState = {
  isOpen: false,
  messages: [],
  isLoading: false,
};

const aiChatSlice = createSlice({
  name: 'aiChat',
  initialState,
  reducers: {
    toggleChat(state) {
      state.isOpen = !state.isOpen;
    },
    openChat(state) {
      state.isOpen = true;
    },
    closeChat(state) {
      state.isOpen = false;
    },
    addMessage(state, { payload }: PayloadAction<Omit<ChatMessage, 'id' | 'timestamp'>>) {
      state.messages.push({
        ...payload,
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        timestamp: Date.now(),
      });
    },
    setLoading(state, { payload }: PayloadAction<boolean>) {
      state.isLoading = payload;
    },
    clearMessages(state) {
      state.messages = [];
    },
  },
});

export const { toggleChat, openChat, closeChat, addMessage, setLoading, clearMessages } = aiChatSlice.actions;
export default aiChatSlice.reducer;
