"""
Documents app serializers
"""
from rest_framework import serializers
from .models import Document, GeneratedArtifact, DocumentCategory


class DocumentSerializer(serializers.ModelSerializer):
    program_title = serializers.CharField(source='program.title', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    uploaded_by_name = serializers.CharField(
        source='uploaded_by.get_full_name', read_only=True, default=''
    )
    file_url = serializers.CharField(source='file.url', read_only=True)

    class Meta:
        model = Document
        fields = [
            'id', 'program', 'program_title', 'title', 'description',
            'category', 'category_display', 'file', 'file_url',
            'original_filename', 'file_size', 'mime_type', 'tags',
            'version', 'replaces',
            'is_public', 'allowed_roles',
            'uploaded_by', 'uploaded_by_name',
            'is_validated', 'validated_by', 'validated_at', 'validation_notes',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'original_filename', 'file_size', 'mime_type', 'version',
            'uploaded_by', 'is_validated', 'validated_by', 'validated_at',
            'validation_notes', 'created_at', 'updated_at',
        ]

    def validate(self, attrs):
        if not attrs.get('file') and self.instance is None:
            raise serializers.ValidationError({'file': 'A file is required.'})
        return attrs

    def create(self, validated_data):
        file_obj = validated_data.get('file')
        if file_obj:
            validated_data['original_filename'] = file_obj.name
            validated_data['mime_type'] = file_obj.content_type or 'application/octet-stream'
            validated_data['file_size'] = file_obj.size
        request = self.context.get('request')
        if request and getattr(request, 'user', None):
            validated_data['uploaded_by'] = request.user
        return super().create(validated_data)


class DocumentUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = [
            'title', 'description', 'category', 'tags', 'is_public',
            'allowed_roles', 'replaces',
        ]

    def update(self, instance, validated_data):
        # When content is replaced, bump version
        if 'file' in self.context.get('request', {}).FILES or 'file' in validated_data:
            latest = Document.objects.filter(
                program=instance.program, title=instance.title
            ).order_by('-version').first()
            instance.version = (latest.version if latest else instance.version) + 1
        return super().update(instance, validated_data)


class DocumentRepresentativeSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    title = serializers.CharField()
    category = serializers.CharField()
    original_filename = serializers.CharField()
    file_size = serializers.IntegerField()
    mime_type = serializers.CharField()
    version = serializers.IntegerField()
    program_title = serializers.CharField()
    uploaded_by_name = serializers.CharField()


class GeneratedArtifactSerializer(serializers.ModelSerializer):
    program_title = serializers.CharField(source='program.title', read_only=True)
    artifact_type_display = serializers.CharField(source='get_artifact_type_display', read_only=True)
    file_url = serializers.CharField(source='file.url', read_only=True)

    class Meta:
        model = GeneratedArtifact
        fields = [
            'id', 'program', 'program_title', 'artifact_type', 'artifact_type_display',
            'related_object_id', 'file', 'file_url', 'file_size',
            'access_token', 'expires_at', 'download_count', 'last_downloaded',
            'generated_by', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'access_token', 'download_count', 'last_downloaded',
            'generated_by', 'created_at', 'updated_at',
        ]