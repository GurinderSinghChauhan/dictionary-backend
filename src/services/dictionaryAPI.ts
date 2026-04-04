import axios from "axios";

export const getWord = async (term: string) => {
  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${term}`;
  const response = await axios.get(url);
  return response.data;
};
