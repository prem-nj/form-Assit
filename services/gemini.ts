import { GoogleGenAI, Type, Schema } from "@google/genai";
import { UserProfile, FormFieldOverlay, Language } from '../types';

// Initialize Gemini Client
// The API key is guaranteed to be in process.env.API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const textModelName = 'gemini-2.5-flash';
const imageModelName = 'gemini-2.5-flash-image';

/**
 * Extracts user profile information from an uploaded ID card image.
 */
export const extractProfileFromImage = async (base64Image: string): Promise<Partial<UserProfile>> => {
  try {
    // Remove header if present (e.g., "data:image/jpeg;base64,")
    const cleanBase64 = base64Image.split(',')[1] || base64Image;

    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        fullName: { type: Type.STRING, description: "Full name of the person" },
        dateOfBirth: { type: Type.STRING, description: "Date of birth in DD/MM/YYYY format" },
        address: { type: Type.STRING, description: "Full address" },
        idNumber: { type: Type.STRING, description: "Unique ID number found on the card (e.g. PAN, Aadhar)" },
        phoneNumber: { type: Type.STRING, description: "Phone number if present" },
        email: { type: Type.STRING, description: "Email address if present" },
      },
      required: ["fullName"],
    };

    const response = await ai.models.generateContent({
      model: textModelName,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64,
            },
          },
          {
            text: "Extract personal information from this ID card. If a field is not visible, return an empty string.",
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text) as Partial<UserProfile>;
  } catch (error) {
    console.error("Error extracting profile:", error);
    throw error;
  }
};

/**
 * Analyzes a blank form image and maps user profile data to the fields.
 */
export const analyzeFormAndMapData = async (
  formImageBase64: string,
  userProfile: UserProfile
): Promise<FormFieldOverlay[]> => {
  try {
    const cleanBase64 = formImageBase64.split(',')[1] || formImageBase64;

    const responseSchema: Schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          fieldName: { type: Type.STRING, description: "The name of the field identified on the form (e.g., 'Name', 'Account No')" },
          valueToFill: { type: Type.STRING, description: "The value from the user profile that should be written here. If no match, leave empty." },
          boundingBox: {
            type: Type.OBJECT,
            properties: {
              ymin: { type: Type.NUMBER },
              xmin: { type: Type.NUMBER },
              ymax: { type: Type.NUMBER },
              xmax: { type: Type.NUMBER },
            },
            required: ["ymin", "xmin", "ymax", "xmax"],
            description: "The bounding box of the empty field space where text should be written. Coordinates normalized 0-1000.",
          },
        },
        required: ["fieldName", "boundingBox", "valueToFill"],
      },
    };

    const prompt = `
      Analyze this physical form image. Identify the blank fields where a user needs to write information.
      
      Here is the User's Profile Data:
      ${JSON.stringify(userProfile)}
      
      For each identifying field on the form:
      1. Determine what information is asked (Name, Date, Address, ID Number, Phone, etc.).
      2. Match it with the provided User Profile Data.
      3. Return the 'valueToFill' exactly as it should be written.
      4. Provide the bounding box for the *blank space* where the user should write.
      
      Coordinates must be on a scale of 0 to 1000.
    `;

    const response = await ai.models.generateContent({
      model: textModelName,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64,
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    return JSON.parse(text) as FormFieldOverlay[];
  } catch (error) {
    console.error("Error analyzing form:", error);
    throw error;
  }
};

/**
 * Edits an image based on a text prompt using Gemini 2.5 Flash Image.
 */
export const editImage = async (base64Image: string, prompt: string): Promise<string> => {
  try {
    const cleanBase64 = base64Image.split(',')[1] || base64Image;

    const response = await ai.models.generateContent({
      model: imageModelName,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    });

    // Iterate through candidates and parts to find the image part
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        // Check for inlineData (image)
        if (part.inlineData && part.inlineData.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    
    throw new Error("No image generated by the model.");
  } catch (error) {
    console.error("Error editing image:", error);
    throw error;
  }
};

/**
 * Explains what the form is about in the specified language.
 */
export const getFormExplanation = async (base64Image: string, language: Language): Promise<string> => {
  try {
    const cleanBase64 = base64Image.split(',')[1] || base64Image;
    
    const prompt = `Analyze this image of a form. Explain briefly what this form is for and what key information is needed. Respond in ${language === 'hi' ? 'Hindi' : language === 'bn' ? 'Bengali' : 'English'}. Keep it simple and under 50 words.`;

    const response = await ai.models.generateContent({
      model: textModelName,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    });

    return response.text || "Could not analyze the form.";
  } catch (error) {
    console.error("Error explaining form:", error);
    throw error;
  }
};

/**
 * Answers a question about the form.
 */
export const askFormQuestion = async (base64Image: string, question: string, language: Language): Promise<string> => {
  try {
    const cleanBase64 = base64Image.split(',')[1] || base64Image;

    const prompt = `Look at this form image. Answer the following question based on the form's visible content: "${question}". Respond in ${language === 'hi' ? 'Hindi' : language === 'bn' ? 'Bengali' : 'English'}. Keep the answer concise.`;

    const response = await ai.models.generateContent({
      model: textModelName,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    });

    return response.text || "Could not answer the question.";
  } catch (error) {
    console.error("Error asking question:", error);
    throw error;
  }
};
